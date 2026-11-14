package com.sungpil987.nyangdoku

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.LinearLayout
import com.google.android.gms.ads.*
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback
import com.google.android.ump.*
import com.android.billingclient.api.*

class MainActivity : android.app.Activity() {
    private lateinit var webView: WebView
    private var banner: AdView? = null
    private var interstitial: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var adsStarted = false
    private var transitionPending = false
    private var rewardRequest = "hint"
    private var adFree = false
    private var billing: BillingClient? = null
    private var removeAdsDetails: ProductDetails? = null

    private val bannerId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/9214589741" else "ca-app-pub-5753154803143305/3592753810"
    private val interstitialId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/1033173712" else "ca-app-pub-5753154803143305/7340427138"
    private val rewardedId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/5224354917" else "ca-app-pub-5753154803143305/9651904863"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyGameFullscreen()
        webView = WebView(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.rgb(250, 246, 241))
        }
        root.addView(webView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        val bannerContainer = FrameLayout(this)
        bannerContainer.tag = "bannerContainer"
        root.addView(bannerContainer, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(root)
        configureWebView()
        setupBilling()
        requestConsentAndStartAds(bannerContainer)
    }

    // Keep content inside the system-managed window; avoid edge-to-edge inset changes.
    // This hides system bars without placing the adaptive banner behind gesture navigation.
    private fun applyGameFullscreen() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyGameFullscreen()
    }

    private fun requestConsentAndStartAds(container: FrameLayout) {
        val info = UserMessagingPlatform.getConsentInformation(this)
        info.requestConsentInfoUpdate(
            this,
            ConsentRequestParameters.Builder().build(),
            {
                UserMessagingPlatform.loadAndShowConsentFormIfRequired(this) {
                    if (info.canRequestAds()) startAds(container)
                }
                if (info.canRequestAds()) startAds(container)
            },
            { if (info.canRequestAds()) startAds(container) }
        )
    }

    private fun startAds(container: FrameLayout) {
        if (adsStarted) return
        adsStarted = true
        MobileAds.initialize(this) {
            runOnUiThread {
                if (adFree) return@runOnUiThread
                val ad = AdView(this)
                banner = ad
                ad.adUnitId = bannerId
                val widthPx = resources.displayMetrics.widthPixels
                val density = resources.displayMetrics.density
                val widthDp = (widthPx / density).toInt().coerceAtLeast(1)
                ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(this, widthDp))
                container.addView(ad, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
                ad.loadAd(AdRequest.Builder().build())
                loadInterstitial()
                loadRewarded()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(AdsBridge(), "NyangdokuAds")
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun loadInterstitial() {
        InterstitialAd.load(this, interstitialId, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { interstitial = ad }
            override fun onAdFailedToLoad(error: LoadAdError) { interstitial = null }
        })
    }

    private fun continueLevel() {
        transitionPending = false
        webView.evaluateJavascript("window.nadoAdvanceLevel && window.nadoAdvanceLevel()", null)
    }

    private fun showInterstitialBetweenLevels() {
        if (transitionPending) return
        if (adFree) { continueLevel(); return }
        transitionPending = true
        val ad = interstitial
        interstitial = null
        if (ad == null) {
            continueLevel()
            if (adsStarted) loadInterstitial()
            return
        }
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { continueLevel(); loadInterstitial() }
            override fun onAdFailedToShowFullScreenContent(error: AdError) { continueLevel(); loadInterstitial() }
        }
        ad.show(this)
    }

    private fun loadRewarded() {
        RewardedAd.load(this, rewardedId, AdRequest.Builder().build(), object : RewardedAdLoadCallback() {
            override fun onAdLoaded(ad: RewardedAd) { rewarded = ad }
            override fun onAdFailedToLoad(error: LoadAdError) { rewarded = null }
        })
    }


    private fun sendAdFreeStatus() {
        webView.evaluateJavascript("window.onAdFreeStatus && window.onAdFreeStatus($adFree)", null)
    }
    private fun setAdFree(owned: Boolean) {
        adFree = owned
        if (owned) {
            banner?.destroy()
            banner = null
            findViewById<ViewGroup>(android.R.id.content)
                .findViewWithTag<FrameLayout>("bannerContainer")?.removeAllViews()
            interstitial = null
        }
        sendAdFreeStatus()
    }
    private fun setupBilling() {
        billing = BillingClient.newBuilder(this)
            .setListener { result, purchases ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK)
                    purchases?.forEach { handlePurchase(it) }
            }
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .build()
        billing?.startConnection(object : BillingClientStateListener {
            override fun onBillingServiceDisconnected() {}
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    queryOwnedPurchases()
                    queryRemoveAdsDetails()
                }
            }
        })
    }
    private fun queryRemoveAdsDetails() {
        val item = QueryProductDetailsParams.Product.newBuilder()
            .setProductId("remove_ads").setProductType(BillingClient.ProductType.INAPP).build()
        billing?.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(listOf(item)).build()
        ) { result, details ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK)
                removeAdsDetails = details.firstOrNull()
        }
    }
    private fun queryOwnedPurchases() {
        billing?.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build()
        ) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                runOnUiThread {
                    setAdFree(purchases.any {
                        it.products.contains("remove_ads") &&
                            it.purchaseState == Purchase.PurchaseState.PURCHASED
                    })
                    purchases.forEach { handlePurchase(it) }
                }
            }
        }
    }
    private fun handlePurchase(purchase: Purchase) {
        if (!purchase.products.contains("remove_ads") ||
            purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        runOnUiThread { setAdFree(true) }
        if (!purchase.isAcknowledged)
            billing?.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
            ) { }
    }
    private fun purchaseRemoveAds() {
        if (adFree) return
        val details = removeAdsDetails
        if (details == null) {
            queryRemoveAdsDetails()
            webView.evaluateJavascript("window.onBillingMessage && window.onBillingMessage('Play Console에서 remove_ads 상품을 활성화해줘')", null)
            return
        }
        billing?.launchBillingFlow(this,
            BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(
                BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()
            )).build()
        )
    }

    private inner class AdsBridge {
        @JavascriptInterface fun buyRemoveAds() { runOnUiThread { purchaseRemoveAds() } }
        @JavascriptInterface fun restorePurchases() { runOnUiThread { queryOwnedPurchases() } }
        @JavascriptInterface fun isAdFree() { runOnUiThread { sendAdFreeStatus() } }
        @JavascriptInterface fun showInterstitialAtMilestone() {
            runOnUiThread { showInterstitialBetweenLevels() }
        }
        @JavascriptInterface fun showRewardedAd(reward: String) {
            runOnUiThread {
                rewardRequest = if (reward == "double") "double" else "hint"
                val ad = rewarded
                if (ad == null) {
                    webView.evaluateJavascript("window.onAdUnavailable && window.onAdUnavailable()", null)
                    if (adsStarted) loadRewarded()
                    return@runOnUiThread
                }
                rewarded = null
                ad.show(this@MainActivity) {
                    webView.evaluateJavascript("window.onRewardedAd && window.onRewardedAd('$rewardRequest')", null)
                }
                loadRewarded()
            }
        }
    }

    override fun onDestroy() {
        billing?.endConnection()
        banner?.destroy()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

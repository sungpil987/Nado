package com.sungpil987.nyangdoku

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.Gravity
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

class MainActivity : android.app.Activity() {
    private lateinit var webView: WebView
    private var banner: AdView? = null
    private var interstitial: InterstitialAd? = null
    private var rewarded: RewardedAd? = null
    private var adsStarted = false
    private var transitionPending = false
    private var rewardRequest = "hint"

    private val bannerId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/9214589741" else "ca-app-pub-5753154803143305/3592753810"
    private val interstitialId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/1033173712" else "ca-app-pub-5753154803143305/7340427138"
    private val rewardedId = "ca-app-pub-3940256099942544/5224354917" // Rewarded monetization not configured yet: test-only.

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(250, 246, 241)
        window.navigationBarColor = android.graphics.Color.rgb(250, 246, 241)
        window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
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
        requestConsentAndStartAds(bannerContainer)
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
                if (BuildConfig.DEBUG) loadRewarded()
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

    private inner class AdsBridge {
        @JavascriptInterface fun showInterstitialAtMilestone() {
            runOnUiThread { showInterstitialBetweenLevels() }
        }
        @JavascriptInterface fun showRewardedAd(reward: String) {
            runOnUiThread {
                if (!BuildConfig.DEBUG) {
                    webView.evaluateJavascript("window.onAdUnavailable && window.onAdUnavailable()", null)
                    return@runOnUiThread\n                }\n                rewardRequest = if (reward == "double") "double" else "hint"
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
        banner?.destroy()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

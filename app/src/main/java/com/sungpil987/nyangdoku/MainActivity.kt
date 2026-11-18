package com.sungpil987.nyangdoku

import android.annotation.SuppressLint
import android.os.Bundle
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.content.Context
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
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.games.SnapshotsClient
import com.google.android.gms.games.snapshot.SnapshotMetadataChange
import org.json.JSONObject
import java.io.IOException

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
    private var playGamesInitialized = false
    private var cloudWriteInProgress = false
    private var queuedCloudSave: String? = null

    private val playGamesConfigured: Boolean
        get() = getString(R.string.game_services_project_id).toLongOrNull()?.let { it > 0L } == true
    private val scoreLeaderboardId: String
        get() = getString(R.string.leaderboard_score_id).trim()

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
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                initializePlayGames()
            }
        }
        webView.addJavascriptInterface(AdsBridge(), "NyangdokuAds")
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun initializePlayGames() {
        if (!playGamesConfigured) {
            sendPlayGamesStatus(false, "Google Play 게임즈 연결 설정이 필요해")
            return
        }
        if (playGamesInitialized) return
        playGamesInitialized = true
        try {
            PlayGamesSdk.initialize(this)
            checkPlayGamesAuthentication()
        } catch (_: Exception) {
            sendPlayGamesStatus(false, "Google Play 게임즈 초기화에 실패했어")
        }
    }

    private fun sendPlayGamesStatus(authenticated: Boolean, message: String) {
        if (!::webView.isInitialized) return
        val safeMessage = JSONObject.quote(message)
        runOnUiThread {
            webView.evaluateJavascript(
                "window.onPlayGamesStatus && window.onPlayGamesStatus($authenticated, $safeMessage)",
                null
            )
        }
    }

    private fun sendCloudError(message: String) {
        val safeMessage = JSONObject.quote(message)
        if (::webView.isInitialized) runOnUiThread {
            webView.evaluateJavascript("window.onCloudSaveError && window.onCloudSaveError($safeMessage)", null)
        }
    }

    private fun checkPlayGamesAuthentication() {
        if (!playGamesConfigured) return
        PlayGames.getGamesSignInClient(this).isAuthenticated().addOnCompleteListener { task ->
            val authenticated = task.isSuccessful && task.result.isAuthenticated
            sendPlayGamesStatus(
                authenticated,
                if (authenticated) "Google Play 게임즈 연결됨" else "Google Play 게임즈 로그인을 확인해줘"
            )
        }
    }

    private fun ensurePlayGamesSignedIn(onResult: (Boolean) -> Unit) {
        if (!playGamesConfigured) {
            sendPlayGamesStatus(false, "Play Console 게임 서비스 설정이 필요해")
            onResult(false)
            return
        }
        if (!playGamesInitialized) {
            try {
                PlayGamesSdk.initialize(this)
                playGamesInitialized = true
            } catch (_: Exception) {
                onResult(false)
                return
            }
        }
        val client = PlayGames.getGamesSignInClient(this)
        client.isAuthenticated().addOnCompleteListener { check ->
            if (check.isSuccessful && check.result.isAuthenticated) {
                sendPlayGamesStatus(true, "Google Play 게임즈 연결됨")
                onResult(true)
            } else {
                client.signIn().addOnCompleteListener { signIn ->
                    val authenticated = signIn.isSuccessful && signIn.result.isAuthenticated
                    sendPlayGamesStatus(
                        authenticated,
                        if (authenticated) "Google Play 게임즈 연결됨" else "Google Play 게임즈 로그인에 실패했어"
                    )
                    onResult(authenticated)
                }
            }
        }
    }

    private fun syncCloudSave(localJson: String) {
        ensurePlayGamesSignedIn { authenticated ->
            if (!authenticated) {
                sendCloudError("Google Play 게임즈 로그인 후 다시 동기화해줘")
                return@ensurePlayGamesSignedIn
            }
            val client = PlayGames.getSnapshotsClient(this)
            client.open(
                "nyangdoku_progress_v1",
                true,
                SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED
            ).addOnSuccessListener { opened ->
                if (opened.isConflict) {
                    sendCloudError("클라우드 저장 충돌을 해결하지 못했어. 다시 시도해줘")
                    return@addOnSuccessListener
                }
                val snapshot = opened.data ?: run {
                    sendCloudError("클라우드 저장을 열 수 없었어. 다시 시도해줘")
                    return@addOnSuccessListener
                }
                try {
                    val cloudBytes = snapshot.snapshotContents.readFully()
                    client.discardAndClose(snapshot)
                    val cloudJson = cloudBytes.toString(Charsets.UTF_8)
                    val safeJson = JSONObject.quote(cloudJson)
                    webView.evaluateJavascript(
                        "window.onCloudSaveLoaded && window.onCloudSaveLoaded($safeJson)",
                        null
                    )
                } catch (_: IOException) {
                    client.discardAndClose(snapshot)
                    sendCloudError("클라우드 저장 데이터를 읽지 못했어")
                } catch (_: Exception) {
                    client.discardAndClose(snapshot)
                    sendCloudError("클라우드 저장 데이터를 읽지 못했어")
                }
            }.addOnFailureListener {
                sendCloudError("클라우드 저장을 불러오지 못했어")
            }
        }
    }

    private fun queueCloudSave(json: String) {
        queuedCloudSave = json
        if (cloudWriteInProgress) return
        ensurePlayGamesSignedIn { authenticated ->
            if (!authenticated) {
                queuedCloudSave = null
                sendCloudError("Google Play 게임즈 로그인 후 다시 동기화해줘")
                return@ensurePlayGamesSignedIn
            }
            val next = queuedCloudSave ?: return@ensurePlayGamesSignedIn
            queuedCloudSave = null
            writeCloudSnapshot(next)
        }
    }

    private fun writeCloudSnapshot(json: String) {
        cloudWriteInProgress = true
        val client = PlayGames.getSnapshotsClient(this)
        client.open(
            "nyangdoku_progress_v1",
            true,
            SnapshotsClient.RESOLUTION_POLICY_MOST_RECENTLY_MODIFIED
        ).addOnSuccessListener { opened ->
            if (opened.isConflict) {
                cloudWriteInProgress = false
                sendCloudError("클라우드 저장 충돌이 생겼어. 동기화를 다시 눌러줘")
                return@addOnSuccessListener
            }
            val snapshot = opened.data ?: run {
                cloudWriteInProgress = false
                sendCloudError("클라우드 저장을 열 수 없었어. 다시 시도해줘")
                return@addOnSuccessListener
            }
            try {
                snapshot.snapshotContents.writeBytes(json.toByteArray(Charsets.UTF_8))
                val metadata = SnapshotMetadataChange.Builder()
                    .setDescription("냥도쿠 진행 상황")
                    .build()
                client.commitAndClose(snapshot, metadata)
                    .addOnSuccessListener { finishCloudWrite(true, "동기화 완료") }
                    .addOnFailureListener { finishCloudWrite(false, "클라우드 저장에 실패했어") }
            } catch (_: IOException) {
                client.discardAndClose(snapshot)
                finishCloudWrite(false, "클라우드 저장 데이터를 쓰지 못했어")
            } catch (_: Exception) {
                client.discardAndClose(snapshot)
                finishCloudWrite(false, "클라우드 저장 데이터를 쓰지 못했어")
            }
        }.addOnFailureListener {
            finishCloudWrite(false, "클라우드 저장을 열지 못했어")
        }
    }

    private fun finishCloudWrite(success: Boolean, message: String) {
        cloudWriteInProgress = false
        if (!success) {
            val safeMessage = JSONObject.quote(message)
            webView.evaluateJavascript(
                "window.onCloudSaveSaved && window.onCloudSaveSaved(false, $safeMessage)",
                null
            )
        }
        val pending = queuedCloudSave
        if (pending != null) {
            queuedCloudSave = null
            writeCloudSnapshot(pending)
        }
    }

    private fun showPlayGamesLeaderboard() {
        if (scoreLeaderboardId.isEmpty()) {
            sendCloudError("Play Console에서 점수 랭킹을 만든 뒤 ID를 연결해야 해")
            return
        }
        ensurePlayGamesSignedIn { authenticated ->
            if (!authenticated) {
                sendCloudError("Google Play 게임즈 로그인 후 랭킹을 열어줘")
                return@ensurePlayGamesSignedIn
            }
            PlayGames.getLeaderboardsClient(this)
                .getLeaderboardIntent(scoreLeaderboardId)
                .addOnSuccessListener { intent -> startActivityForResult(intent, 9004) }
                .addOnFailureListener { sendCloudError("랭킹을 불러오지 못했어") }
        }
    }

    private fun submitPlayGamesScore(score: Long) {
        if (scoreLeaderboardId.isEmpty() || score <= 0L) return
        ensurePlayGamesSignedIn { authenticated ->
            if (authenticated) {
                PlayGames.getLeaderboardsClient(this)
                    .submitScore(scoreLeaderboardId, score)
            }
        }
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
                removeAdsDetails = details.productDetailsList.firstOrNull()
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

    private fun playHaptic(kind: String) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator)
        }
        if (!vibrator.hasVibrator()) return
        val timings = when (kind) {
            "wrong" -> longArrayOf(0, 35, 45, 55)
            "win" -> longArrayOf(0, 22, 55, 35)
            "hint" -> longArrayOf(0, 25, 40, 25)
            "cat" -> longArrayOf(0, 24)
            "x" -> longArrayOf(0, 12)
            else -> longArrayOf(0, 16)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(timings, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(timings, -1)
        }
    }

    private inner class AdsBridge {
        @JavascriptInterface fun syncCloudSave(localJson: String) {
            runOnUiThread { this@MainActivity.syncCloudSave(localJson) }
        }
        @JavascriptInterface fun saveCloudSave(json: String) {
            runOnUiThread { queueCloudSave(json) }
        }
        @JavascriptInterface fun showLeaderboard() {
            runOnUiThread { showPlayGamesLeaderboard() }
        }
        @JavascriptInterface fun submitLeaderboardScore(score: Long) {
            runOnUiThread { submitPlayGamesScore(score) }
        }
        @JavascriptInterface fun vibrate(kind: String) {
            runOnUiThread { playHaptic(kind) }
        }
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

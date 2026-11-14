package com.sungpil987.nyangdoku

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.rewarded.RewardedAd
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var rewardedAd: RewardedAd? = null
    private var requestedReward = "hint"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(250, 246, 241)
        window.navigationBarColor = android.graphics.Color.rgb(250, 246, 241)
        window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
            android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        MobileAds.initialize(this) { loadRewardedAd() }
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

    private fun loadRewardedAd() {
        RewardedAd.load(this, "ca-app-pub-3940256099942544/5224354917", AdRequest.Builder().build(),
            object : RewardedAdLoadCallback() {
                override fun onAdLoaded(ad: RewardedAd) { rewardedAd = ad }
                override fun onAdFailedToLoad(error: com.google.android.gms.ads.LoadAdError) { rewardedAd = null }
            })
    }

    private inner class AdsBridge {
        @JavascriptInterface
        fun showRewardedAd(reward: String) {
            runOnUiThread {
                requestedReward = if (reward == "double") "double" else "hint"
                val ad = rewardedAd
                if (ad == null) {
                    webView.evaluateJavascript("window.onAdUnavailable && window.onAdUnavailable()", null)
                    loadRewardedAd()
                    return@runOnUiThread
                }
                rewardedAd = null
                ad.show(this@MainActivity) {
                    val kind = requestedReward
                    webView.evaluateJavascript("window.onRewardedAd && window.onRewardedAd('$kind')", null)
                }
                loadRewardedAd()
            }
        }
    }

    @Deprecated("Deprecated in Android")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

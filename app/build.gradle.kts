plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sungpil987.nyangdoku"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sungpil987.nyangdoku"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
}

dependencies {
    implementation("com.google.android.gms:play-services-ads:25.5.0")
}

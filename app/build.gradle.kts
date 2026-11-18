plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sungpil987.nyangdoku"
    compileSdk = 36
    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId = "com.sungpil987.nyangdoku"
        minSdk = 24
        targetSdk = 36
        versionCode = 43
        versionName = "1.3.7"
    }
}

dependencies {
    implementation("com.google.android.gms:play-services-ads:25.5.0")
    implementation("com.google.android.ump:user-messaging-platform:3.2.0")
    implementation("com.android.billingclient:billing-ktx:8.0.0")
    implementation("com.google.android.gms:play-services-games-v2:22.1.0")
}

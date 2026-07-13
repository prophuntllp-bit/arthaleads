import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
    id("com.google.gms.google-services")
}

// Release signing — populated from android/key.properties, written either
// by hand locally (copy key.properties.example) or by CI from GitHub
// secrets (see .github/workflows/mobile-flutter-ci.yml). Falls back to
// debug signing when the file is absent, so `flutter build apk --debug`
// keeps working with no setup.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
fun signingProp(key: String): String? =
    keystoreProperties.getProperty(key) ?: project.findProperty(key) as String?

android {
    namespace = "com.arthaleads.arthaleads_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true // required by flutter_local_notifications
    }

    defaultConfig {
        // Matches the Capacitor app's ID (com.arthaleads.crm) — this Flutter
        // app replaces it and reuses its Firebase project (FCM, Google Sign-In)
        // registration, which is tied to this package name + signing cert.
        applicationId = "com.arthaleads.crm"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            val storeFilePath = signingProp("storeFile")
            if (storeFilePath != null) {
                storeFile = rootProject.file(storeFilePath)
                storePassword = signingProp("storePassword")
                keyAlias = signingProp("keyAlias")
                keyPassword = signingProp("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            // Real release signing when key.properties (local) or -P signing
            // properties (CI) are present; falls back to debug signing so
            // `flutter build apk --release` never hard-fails with no setup.
            signingConfig = if (signingProp("storeFile") != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}

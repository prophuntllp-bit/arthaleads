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
// keeps working with no setup. Bundles are the exception: see buildTypes below.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
fun signingProp(key: String): String? =
    keystoreProperties.getProperty(key) ?: project.findProperty(key) as String?

// CI signs through AGP's injected properties rather than key.properties -- see
// .github/workflows/build-apk.yml -- and those override the signingConfig at
// task level, so their presence counts as being properly signed.
val hasInjectedSigning = project.hasProperty("android.injected.signing.store.file")

// An AAB is only ever built to be uploaded. A store build that quietly falls
// back to the debug keystore produces an artifact Play refuses at upload,
// after the build has already reported success -- so it fails here instead,
// where the message can say what is missing.
val isBundleBuild = gradle.startParameter.taskNames.any { it.contains("bundle", ignoreCase = true) }

android {
    namespace = "com.arthaleads.arthaleads_mobile"
    // file_picker's transitive flutter_plugin_android_lifecycle dependency requires
    // compileSdk 36+ — bumped explicitly since Flutter's own default still lags behind.
    compileSdk = 36
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
            // Real release signing when key.properties (local) or the injected
            // -P properties (CI) are present. An unsigned APK still builds, so
            // `flutter build apk --release` needs no setup -- but it says so
            // loudly, and an unsigned *bundle* refuses to build at all.
            signingConfig = when {
                signingProp("storeFile") != null -> signingConfigs.getByName("release")
                hasInjectedSigning -> signingConfigs.getByName("debug") // AGP overrides per task
                isBundleBuild -> error(
                    """
                    Refusing to build a release bundle with debug signing.

                    Play rejects debug-signed uploads, so this build would otherwise have
                    reported success and failed only at upload, which is the expensive place
                    to find out.

                    Provide android/key.properties with storeFile, storePassword, keyAlias
                    and keyPassword, or pass -Pandroid.injected.signing.* the way
                    .github/workflows/build-apk.yml does.
                    """.trimIndent()
                )
                else -> {
                    logger.warn(
                        "WARNING: this release APK is DEBUG-SIGNED. Fine for local testing, " +
                        "not uploadable to Play. Add android/key.properties to sign it properly."
                    )
                    signingConfigs.getByName("debug")
                }
            }
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    // Without this, one release APK bundles native libs for every CPU
    // architecture (arm64-v8a, armeabi-v7a, x86_64, x86) — most of the
    // 70MB release APK. Splitting emits one small APK per architecture
    // (~15-20MB each) plus a universal fallback for sideloading/testing.
    splits {
        abi {
            isEnable = true
            reset()
            include("armeabi-v7a", "arm64-v8a", "x86_64")
            isUniversalApk = true
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

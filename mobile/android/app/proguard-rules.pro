# Flutter's own engine/embedding classes are invoked via JNI from native code,
# which R8 can't see — without these keeps, minification silently breaks the
# engine at runtime instead of failing the build.
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Firebase Cloud Messaging / Google Sign-In / Play Services resolve classes
# by name at runtime (Parcelable CREATORs, service loaders) — same problem.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

-keepattributes Signature,*Annotation*,EnclosingMethod,InnerClasses
-keepclassmembers class * implements android.os.Parcelable {
    static ** CREATOR;
}

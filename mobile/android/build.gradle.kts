allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

// Force every plugin module (file_picker, geolocator_android, etc.) to compile
// against SDK 36 too — they otherwise inherit Flutter's own (older) default via
// `flutter.compileSdkVersion`, which is lower than what flutter_plugin_android_lifecycle
// now requires of its consumers. Must be registered before evaluationDependsOn(":app")
// forces early evaluation below.
subprojects {
    if (project.name != "app") {
        project.afterEvaluate {
            extensions.findByName("android")?.let { ext ->
                (ext as com.android.build.gradle.BaseExtension).compileSdkVersion(36)
            }
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}

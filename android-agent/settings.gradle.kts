pluginManagement {
    repositories {
        maven { url = uri("https://dl.google.com/dl/android/maven2/") }
        maven { url = uri("https://maven.google.com") }
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_SETTINGS)
    repositories {
        maven { url = uri("https://dl.google.com/dl/android/maven2/") }
        maven { url = uri("https://maven.google.com") }
        google()
        mavenCentral()
    }
}

rootProject.name = "RemoteAgent"
include(":app")

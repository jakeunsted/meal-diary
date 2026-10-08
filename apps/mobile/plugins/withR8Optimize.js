const { withAppBuildGradle } = require("@expo/config-plugins");

const PROGUARD_ANDROID = 'getDefaultProguardFile("proguard-android.txt")';
const PROGUARD_ANDROID_OPTIMIZE =
  'getDefaultProguardFile("proguard-android-optimize.txt")';

/** Use the optimize ProGuard defaults so R8 does not inherit -dontoptimize. */
function withR8Optimize(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      throw new Error("withR8Optimize expects a Groovy app/build.gradle");
    }

    const contents = config.modResults.contents;
    if (contents.includes(PROGUARD_ANDROID_OPTIMIZE)) {
      return config;
    }

    if (!contents.includes(PROGUARD_ANDROID)) {
      throw new Error(
        "withR8Optimize could not find proguard-android.txt in app/build.gradle",
      );
    }

    config.modResults.contents = contents.replace(
      PROGUARD_ANDROID,
      PROGUARD_ANDROID_OPTIMIZE,
    );
    return config;
  });
}

module.exports = withR8Optimize;

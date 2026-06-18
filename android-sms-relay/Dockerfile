FROM eclipse-temurin:17-jdk-jammy

RUN apt-get update && apt-get install -y --no-install-recommends wget unzip \
    && rm -rf /var/lib/apt/lists/*

# Android SDK
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip \
         -O /tmp/cmdlinetools.zip \
    && unzip -q /tmp/cmdlinetools.zip -d /tmp/clt \
    && mv /tmp/clt/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm -rf /tmp/clt /tmp/cmdlinetools.zip

RUN yes | sdkmanager --licenses \
    && sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

WORKDIR /app

# Copy gradle files first to cache the dependency download layer
COPY gradle/ gradle/
COPY gradlew gradle.properties build.gradle.kts settings.gradle.kts ./
COPY app/build.gradle.kts app/

RUN chmod +x gradlew

# Pre-download Gradle distribution and project dependencies
RUN ./gradlew :app:dependencies --no-daemon

# Copy the rest of the source
COPY . .

# Inject config (passed as build args, fallback to empty string)
ARG SERVER_URL=""
ARG API_SECRET=""
RUN printf 'SERVER_URL=%s\nAPI_SECRET=%s\n' "$SERVER_URL" "$API_SECRET" > local.properties

RUN ./gradlew assembleDebug --no-daemon

FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends build-essential ca-certificates curl wget file pkg-config libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf libfuse2 xdg-utils xvfb xauth && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.99.1
RUN curl -fsSL https://nodejs.org/dist/v24.22.3/node-v24.22.3-linux-x64.tar.xz | tar -xJ --strip-components=1 -C /usr/local
ENV PATH="/root/.cargo/bin:${PATH}"
ENV CARGO_BUILD_JOBS=4 CARGO_INCREMENTAL=0 CI=true APPIMAGE_EXTRACT_AND_RUN=1
WORKDIR /build
CMD ["bash", "scripts/build-linux.sh"]

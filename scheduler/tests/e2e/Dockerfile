# A stand-in for the box's OS for the end-to-end rehearsal: Raspberry Pi OS
# Lite (64-bit) is Debian 13 (trixie) on arm64 plus the Raspberry Pi archive,
# which supplies Raspberry Pi's builds of ffmpeg and other packages. Built
# by box.e2e.sh; see that file.
FROM debian:trixie

ENV DEBIAN_FRONTEND=noninteractive
# The Raspberry Pi archive, signed with the key Raspberry Pi OS itself ships
# (raspberrypi-archive-keyring; the older raspberrypi.gpg.key is SHA-1 bound,
# which Debian 13 rejects).
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends ca-certificates curl sudo >/dev/null \
 && curl -fsSL -o /tmp/keyring.deb \
    http://archive.raspberrypi.com/debian/pool/main/r/raspberrypi-archive-keyring/raspberrypi-archive-keyring_2025.1+rpt1_all.deb \
 && dpkg -i /tmp/keyring.deb >/dev/null && rm /tmp/keyring.deb \
 && printf 'Types: deb\nURIs: http://archive.raspberrypi.com/debian/\nSuites: trixie\nComponents: main\nSigned-By: /usr/share/keyrings/raspberrypi-archive-keyring.pgp\n' \
    > /etc/apt/sources.list.d/raspi.sources

# What setup.sh installs, ahead of time so reruns are quick (setup.sh still
# runs apt-get itself), plus tools only the test uses: ffmpeg to make test
# clips and read frames, git for sync, systemd for systemd-analyze, procps.
RUN apt-get update -qq \
 && apt-get install -y -qq --no-install-recommends mpv nodejs git logrotate ffmpeg systemd procps >/dev/null \
 && rm -rf /var/lib/apt/lists/*

# The person's user, as Raspberry Pi Imager creates it (sudo asks for no
# password here; on a real box it does).
RUN useradd -m -s /bin/bash -G sudo pi && echo 'pi ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/pi

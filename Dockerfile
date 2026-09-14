# The demo container.
#
# One stage, not the usual slim multi-stage build. A trimmed runtime image has
# to list every file the app needs at run time, and this app needs more than a
# plain Next.js one: `next start` loads `next.config.ts`, which imports the
# redirect overrides as TypeScript, and the entrypoint runs a Payload script,
# which loads the Payload config and everything under src/. A forgotten file
# there fails in the deployed container, which is the worst place to find out.
# The image is larger; it is a demo, and it boots.
#
# Debian rather than Alpine because of sharp. Payload resizes every uploaded
# image with it, and sharp on musl is a recurring source of "works on my
# machine" — installing the wrong prebuilt binary and failing on the first
# upload rather than at build time.

FROM node:22-bookworm-slim

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, so a change to the source does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The build prerenders 800+ pages by asking Payload for their content, so it
# needs a database to read. This is the sanitised copy — see
# scripts/demo-prepare.ts for what has been taken out of it and why.
ENV DATABASE_URI=file:/app/demo-data/diocese.db

# Used to sign tokens at run time, where Render supplies the real value. This
# one exists only so the config can be loaded during the build.
ENV PAYLOAD_SECRET=build-time-placeholder

# The site's own address. It has to be set here, not just at run time: it is
# baked into the sitemap and into the structured data on every prerendered
# page. Render passes the service's environment variables to the build, which
# is what these two lines pick up.
ARG NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL

ARG DEMO_NOINDEX
ENV DEMO_NOINDEX=$DEMO_NOINDEX

RUN npm run build

# The uploads move aside so the entrypoint can copy them onto the mounted disk
# on first boot without the two being the same directory.
RUN mv media seed-media && mv documents seed-documents

ENV NODE_ENV=production

RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]

# Local Test Portal

The portal runs at `http://127.0.0.1:4173` and binds to loopback only. It uses the existing `TEST_USERNAME` and `TEST_PASSWORD` values from `.env` as its only login. There is no registration, invite list, or one-time-code flow. The password is checked by the local server and is never sent back to the browser or written to the server log.

## Start it

1. Ensure `.env` contains `TEST_USERNAME` and `TEST_PASSWORD`.
2. From the `Test1` project folder, run `npm run portal`.
3. Open `http://127.0.0.1:4173` and sign in with those same environment credentials.
4. Select **Run tests** to start Playwright locally. After the run finishes, its report, screenshots, and videos are saved in local history. Use the calendar to filter runs by date.

Local report data is stored under `team-portal/data/` and is ignored by Git. It remains on this computer unless you remove that folder. The portal does not send runs to GitHub Actions.

## Localhost scope

`127.0.0.1` is reachable only from this computer. Teammates on other devices cannot use this instance; sharing it requires a hosted server with separately configured authentication and email delivery.

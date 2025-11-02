README - steady-watch

This project is preconfigured for the Steady Teddys collection (Magic Eden, Berachain)
and the trait Clothing = Saudi, threshold 200 BERA.

Quick steps to produce an APK via Expo EAS:
1) Create an Expo account at https://expo.dev/signup
2) Install EAS CLI locally (or use it in CI):
   npm install -g eas-cli
3) Login & create token:
   eas login
   eas token:create
4) Create a GitHub repo and upload this project (or upload via GitHub UI)
5) Add repository secret EAS_TOKEN with the token value
6) Go to Actions -> run "Build Android (EAS)" workflow (or push to main)
7) Download the APK artifact when the workflow finishes.

If you prefer I guide you step-by-step, tell me and I will.

// Polyfills load before anything else: WebCrypto (getRandomValues, subtle) is needed by Mera in S6 and Hermes lacks it.
import "./src/polyfills";
import "expo-router/entry";

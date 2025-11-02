import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet, Platform, Vibration } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

/* === CONFIG PERSONNALISÉE POUR TOI === */
const DEFAULT_COLLECTION_SYMBOL = "steadyteddys";
const DEFAULT_TRAIT_NAME = "Clothing";
const DEFAULT_TRAIT_VALUE = "Saudi";
const DEFAULT_THRESHOLD = 200;
const POLL_INTERVAL_MS = 30_000; // 30s

// Notifications handler: show alert, play no sound (user requested "sansson")
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export default function App() {
  const [traitName, setTraitName] = useState(DEFAULT_TRAIT_NAME);
  const [traitValue, setTraitValue] = useState(DEFAULT_TRAIT_VALUE);
  const [threshold, setThreshold] = useState(String(DEFAULT_THRESHOLD));
  const [monitoring, setMonitoring] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const seenIdsRef = useRef(new Set());
  const pollTimerRef = useRef(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("alerts");
      if (stored) {
        const parsed = JSON.parse(stored);
        setAlerts(parsed);
        parsed.forEach(a => seenIdsRef.current.add(a.listingId || `${a.tokenId}-${a.seller}`));
      }
    })();
    registerForPushNotificationsAsync();
    return () => stopPolling();
  }, []);

  async function registerForPushNotificationsAsync() {
    if (!Constants.isDevice) return;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") {
      Alert.alert("Notifications désactivées", "Autorise les notifications pour recevoir les alertes.");
    }
  }

  async function notifyLocal(title, body) {
    if (Platform.OS === "android") Vibration.vibrate(500);
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  }

  async function saveAlert(a) {
    const newList = [a, ...alerts].slice(0, 200);
    setAlerts(newList);
    await AsyncStorage.setItem("alerts", JSON.stringify(newList));
  }

  function startPolling() {
    if (monitoring) return;
    setMonitoring(true);
    pollOnce();
    pollTimerRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setMonitoring(false);
  }

  async function pollOnce() {
    const symbol = DEFAULT_COLLECTION_SYMBOL;
    const url = `https://api-mainnet.magiceden.io/v2/collections/${encodeURIComponent(symbol)}/listings`;
    try {
      const resp = await fetch(url, { method: "GET" });
      if (!resp.ok) return;
      const data = await resp.json();
      const listings = Array.isArray(data) ? data : data.listings || data;
      const thr = parseFloat(threshold) || DEFAULT_THRESHOLD;

      for (const l of listings) {
        const tokenId = l.tokenId || l.tokenMint || l.token || l.itemId || null;
        const price = (() => {
          if (typeof l.price === "number") return Number(l.price);
          if (l.price && !isNaN(Number(l.price))) return Number(l.price);
          return Number(l?.priceInLamports || 0);
        })();
        const metadata = l.extra || l.metadata || l;
        const attributes = metadata?.attributes || metadata?.traits || [];
        const hasTrait = attributes.some(a => {
          const k = (a.trait_type || a.traitType || a.type || "").toString();
          const v = (a.value || a.val || a.trait_value || "").toString();
          return k.toLowerCase() === traitName.toLowerCase() && v.toLowerCase() === traitValue.toLowerCase();
        });

        if (hasTrait && price <= thr) {
          const listingId = l.listingId || `${tokenId}-${l.seller || "s"}`;
          if (!seenIdsRef.current.has(listingId)) {
            seenIdsRef.current.add(listingId);
            const alertObj = {
              tokenId: tokenId,
              price: price,
              seller: l.seller || null,
              listingId,
              time: new Date().toISOString()
            };
            await saveAlert(alertObj);
            await notifyLocal("NFT trouvé ✅", `#${tokenId} listé ${price} BERA`);
          }
        }
      }
    } catch (err) {
      console.log("Poll error", err?.message || err);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧸 Steady Watch</Text>

      <View style={styles.row}>
        <TextInput style={styles.input} value={traitName} onChangeText={setTraitName} placeholder="Trait name" />
        <TextInput style={styles.input} value={traitValue} onChangeText={setTraitValue} placeholder="Trait value" />
      </View>

      <View style={styles.row}>
        <TextInput style={[styles.input, {flex:1}]} value={threshold} onChangeText={setThreshold} keyboardType="numeric" />
        <TouchableOpacity style={monitoring ? styles.stopButton : styles.startButton} onPress={() => monitoring ? stopPolling() : startPolling()}>
          <Text style={styles.btnText}>{monitoring ? "⏸ Stop" : "▶️ Start"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.h2}>Alertes récentes</Text>
      <FlatList
        data={alerts}
        keyExtractor={(it) => it.listingId}
        renderItem={({ item }) => (
          <View style={styles.alertItem}>
            <Text style={styles.alertText}>#{item.tokenId} — {item.price} BERA</Text>
            <Text style={styles.small}>{new Date(item.time).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:16, paddingTop:50, backgroundColor:"#0b1220" },
  title: { fontSize:22, fontWeight:"700", color:"#fff", marginBottom:12, textAlign:"center" },
  row: { flexDirection:"row", gap:8, marginBottom:10 },
  input: { backgroundColor:"#fff", padding:10, borderRadius:8, flex:0.5, marginRight:6 },
  startButton: { backgroundColor:"#10b981", padding:12, borderRadius:8, justifyContent:"center", alignItems:"center" },
  stopButton: { backgroundColor:"#ef4444", padding:12, borderRadius:8, justifyContent:"center", alignItems:"center" },
  btnText: { color:"#fff", fontWeight:"700" },
  h2: { color:"#fff", marginTop:12, marginBottom:6, fontWeight:"700" },
  alertItem: { backgroundColor:"#111827", padding:10, borderRadius:8, marginBottom:8 },
  alertText: { color:"#fff", fontSize:16 },
  small: { color:"#9ca3af", fontSize:12, marginTop:4 }
});

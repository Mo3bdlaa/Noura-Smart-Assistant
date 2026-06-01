/**
 * Noura Local — Proof of Concept.
 * A fully on-device chat with Noura. No server, no network: the model runs on the
 * phone via llama.rn, and the persona is the same one the cloud product uses.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DocumentPicker from "react-native-document-picker";
import RNFS from "react-native-fs";
import { buildSystemPrompt } from "./src/persona/noura";
import { chat, isLoaded, loadModel, type ChatTurn } from "./src/llm/LlamaService";

const MODEL_PATH = `${RNFS.DocumentDirectoryPath}/noura-model.gguf`;
const USER_NAME = "محمد"; // POC: hard-coded; the full app reads this from the profile.

type Msg = { id: string; role: "user" | "assistant"; text: string };
type Status = "checking" | "need-model" | "loading" | "ready";

export default function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [loadPct, setLoadPct] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  // On launch, auto-load the model if it's already on the device.
  useEffect(() => {
    (async () => {
      const exists = await RNFS.exists(MODEL_PATH);
      if (!exists) return setStatus("need-model");
      await doLoad(MODEL_PATH);
    })();
  }, []);

  const doLoad = useCallback(async (path: string) => {
    setStatus("loading");
    try {
      await loadModel(path, (p) => setLoadPct(Math.round(p)));
      setStatus("ready");
    } catch (e) {
      console.error(e);
      setStatus("need-model");
    }
  }, []);

  // Let the user pick a GGUF, copy it into app storage, then load.
  const pickModel = useCallback(async () => {
    try {
      const res = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.allFiles] });
      setStatus("loading");
      setLoadPct(0);
      // Copy into the app's private dir so llama.rn gets a real readable path.
      await RNFS.copyFile(res.uri, MODEL_PATH);
      await doLoad(MODEL_PATH);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) console.error(e);
      setStatus("need-model");
    }
  }, [doLoad]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy || !isLoaded()) return;
    setInput("");
    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", text };
    const draftId = `a${Date.now()}`;
    setMessages((m) => [...m, userMsg, { id: draftId, role: "assistant", text: "" }]);
    setBusy(true);

    // Build the conversation: system prompt + full history (POC keeps it all in RAM).
    const history: ChatTurn[] = [
      { role: "system", content: buildSystemPrompt({ userName: USER_NAME }) },
      ...messages.map((m) => ({ role: m.role, content: m.text }) as ChatTurn),
      { role: "user", content: text },
    ];

    try {
      await chat(history, (partial) => {
        setMessages((m) => m.map((x) => (x.id === draftId ? { ...x, text: partial } : x)));
      });
    } catch (e) {
      console.error(e);
      setMessages((m) =>
        m.map((x) => (x.id === draftId ? { ...x, text: "[حصل خطأ في التوليد]" } : x)),
      );
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f0e13" />
      <View style={styles.header}>
        <Text style={styles.title}>نورا</Text>
        <Text style={styles.subtitle}>
          {status === "ready" ? "موجودة معاك · محلي 100%" : "محلي · أوفلاين"}
        </Text>
      </View>

      {status !== "ready" ? (
        <View style={styles.center}>
          {status === "checking" && <ActivityIndicator color="#e0a96d" />}
          {status === "loading" && (
            <>
              <ActivityIndicator color="#e0a96d" />
              <Text style={styles.muted}>بحمّل الموديل… {loadPct}%</Text>
            </>
          )}
          {status === "need-model" && (
            <>
              <Text style={styles.muted}>محتاج ملف الموديل (GGUF) مرة واحدة بس</Text>
              <Pressable style={styles.btn} onPress={pickModel}>
                <Text style={styles.btnText}>اختار ملف الموديل</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={styles.bubbleText}>{item.text || "…"}</Text>
              </View>
            )}
          />
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="اكتب لـ نورا…"
              placeholderTextColor="#6b6675"
              multiline
            />
            <Pressable
              style={[styles.sendBtn, busy && styles.sendBtnOff]}
              onPress={send}
              disabled={busy}
            >
              <Text style={styles.btnText}>{busy ? "…" : "بعت"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f0e13" },
  flex: { flex: 1 },
  header: { paddingVertical: 14, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#221f2b" },
  title: { color: "#f3eef7", fontSize: 20, fontWeight: "700" },
  subtitle: { color: "#e0a96d", fontSize: 12, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  muted: { color: "#9a93a8", fontSize: 14, textAlign: "center" },
  list: { padding: 14, gap: 10 },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#e0a96d" },
  aiBubble: { alignSelf: "flex-start", backgroundColor: "#1c1a24" },
  bubbleText: { color: "#fff", fontSize: 16, textAlign: "right", writingDirection: "rtl", lineHeight: 23 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: "#221f2b" },
  input: {
    flex: 1,
    backgroundColor: "#1c1a24",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#f3eef7",
    fontSize: 16,
    textAlign: "right",
    maxHeight: 120,
  },
  sendBtn: { backgroundColor: "#e0a96d", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12 },
  sendBtnOff: { opacity: 0.5 },
  btn: { backgroundColor: "#e0a96d", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: "#0f0e13", fontWeight: "700", fontSize: 15 },
});

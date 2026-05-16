"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { Loader2 } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const THINKING_PHRASES = [
  "Thinking",
  "Analyzing",
  "Crunching numbers",
  "Pondering",
  "Calculating",
  "Working it out",
  "Figuring it out",
  "Discombobulating",
  "Wandering",
  "Processing",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("there");
  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0]);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLoadingRef = useRef(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }

  // Load message history and owner name
  useEffect(() => {
    async function loadData() {
      try {
        const [messagesRes, settingsRes] = await Promise.all([
          fetch("/api/messages"),
          fetch("/api/settings"),
        ]);
        if (messagesRes.ok) {
          const data = await messagesRes.json();
          setMessages(data);
        }
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          if (settings.owner_name && settings.owner_name !== "there") {
            setOwnerName(settings.owner_name);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setInitialLoading(false);
      }
    }
    loadData();
  }, []);

  // Scroll to bottom whenever messages change or loading finishes
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, initialLoading]);

  // Cycling thinking phrases while loading
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_PHRASES.length;
      setThinkingPhrase(THINKING_PHRASES[i]);
    }, 900);
    return () => clearInterval(interval);
  }, [loading]);

  // Typewriter effect: trigger when loading transitions false → new assistant message
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (wasLoading && !loading) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg.content) {
        // Clear any existing stream
        if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);

        setStreamingId(lastMsg.id);
        setStreamingText("");

        let i = 0;
        const content = lastMsg.content;
        streamIntervalRef.current = setInterval(() => {
          i++;
          setStreamingText(content.slice(0, i));
          scrollToBottom();
          if (i >= content.length) {
            if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
            setStreamingId(null);
            setStreamingText("");
          }
        }, 12);
      }
    }
  }, [loading, messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: `📷 Receipt uploaded: ${file.name}`,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: `✅ ${data.message}${data.flagged > 0 ? "\n\n⚠️ Some entries were flagged for CPA review — check the Journal tab." : ""}`,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Receipt upload failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "Sorry, I couldn't read that receipt. Make sure it's a clear photo (JPG or PNG) and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleSend(message: string) {
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setThinkingPhrase(THINKING_PHRASES[0]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error("Failed to send:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {initialLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 py-4 px-4 md:px-6 bg-muted/40">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                B
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed">
                  Welcome, <strong>{ownerName}</strong>! 👋 I&apos;m your
                  bookkeeping assistant, here to help you with:
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>
                    <strong>Logging transactions</strong> — just describe them
                    in plain English and I&apos;ll create proper journal entries
                    with GST
                  </li>
                  <li>
                    <strong>Tracking your finances</strong> — ask me about
                    revenue, expenses, GST owing, etc.
                  </li>
                  <li>
                    <strong>Tax planning</strong> — I can suggest ways to reduce
                    your taxes and flag things for your CPA
                  </li>
                </ul>
                <p className="text-sm mt-3">
                  Tell me a little bit about your business and we can get
                  started! Or tap 📷 to upload a receipt.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => {
              const isStreaming = msg.id === streamingId;
              return (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={isStreaming ? streamingText : msg.content}
                />
              );
            })}
            {loading && (
              <div className="flex gap-3 py-4 px-4 md:px-6 bg-muted/40">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="flex items-center">
                  <p className="text-sm text-muted-foreground">
                    {thinkingPhrase}
                    <span className="animate-pulse">...</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} onUpload={handleUpload} disabled={loading} />
    </div>
  );
}

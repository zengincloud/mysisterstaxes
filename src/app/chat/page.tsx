"use client";

import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { Loader2 } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("there");
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(message: string) {
    // Optimistically add user message
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

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
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content:
          "Sorry, something went wrong. Please try again.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
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
                  started!
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                role={msg.role}
                content={msg.content}
              />
            ))}
            {loading && (
              <div className="flex gap-3 py-4 px-4 md:px-6 bg-muted/40">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div className="flex items-center">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load message history
  useEffect(() => {
    async function loadMessages() {
      try {
        const res = await fetch("/api/messages");
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setInitialLoading(false);
      }
    }
    loadMessages();
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
          <div className="flex items-center justify-center h-full px-4">
            <div className="text-center max-w-md">
              <div className="text-5xl mb-4">📒</div>
              <h2 className="text-xl font-semibold mb-2">
                Welcome to My Sister&apos;s Taxes
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                I&apos;m your bookkeeping assistant. Just tell me about your
                business transactions in plain English and I&apos;ll log them
                as proper journal entries.
              </p>
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>&quot;I invoiced a client $5,000 today&quot;</p>
                <p>&quot;Bought office supplies at Staples for $200&quot;</p>
                <p>&quot;How much revenue this year?&quot;</p>
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { Loader2, Square, Plus, Trash2, ChevronLeft, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Session {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

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
  "Discombobulating",
  "Wandering",
  "Processing",
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [showSessionsOnMobile, setShowSessionsOnMobile] = useState(true);
  const [thinkingPhrase, setThinkingPhrase] = useState(THINKING_PHRASES[0]);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLoadingRef = useRef(false);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: number) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/messages?sessionId=${sessionId}`);
      if (res.ok) {
        setMessages(await res.json());
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Scroll to bottom on messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, messagesLoading]);

  // Cycling thinking phrases
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % THINKING_PHRASES.length;
      setThinkingPhrase(THINKING_PHRASES[i]);
    }, 900);
    return () => clearInterval(interval);
  }, [loading]);

  // Typewriter effect
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;

    if (wasLoading && !loading) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg.content) {
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

  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  function selectSession(session: Session) {
    setActiveSessionId(session.id);
    setMessages([]);
    setShowSessionsOnMobile(false);
    loadMessages(session.id);
  }

  function newChat() {
    setActiveSessionId(null);
    setMessages([]);
    setShowSessionsOnMobile(false);
  }

  async function deleteSession(e: React.MouseEvent, sessionId: number) {
    e.stopPropagation();
    await fetch(`/api/sessions?id=${sessionId}`, { method: "DELETE" });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setStreamingId(null);
    setStreamingText("");
    setLoading(false);
  }

  const handleUpload = useCallback(async (file: File) => {
    if (showSessionsOnMobile) setShowSessionsOnMobile(false);
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
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `✅ ${data.message}${data.flagged > 0 ? "\n\n⚠️ Some entries flagged for CPA review — check the Journal tab." : ""}`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Sorry, I couldn't read that receipt. Make sure it's a clear photo (JPG or PNG) and try again.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [showSessionsOnMobile]);

  async function handleSend(message: string) {
    if (showSessionsOnMobile) setShowSessionsOnMobile(false);
    const userMsg: Message = {
      id: Date.now(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setThinkingPhrase(THINKING_PHRASES[0]);
    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sessionId: activeSessionId }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed to send message");

      const data = await res.json();

      // If a new session was created, update state and refresh list
      if (data.sessionId && data.sessionId !== activeSessionId) {
        setActiveSessionId(data.sessionId);
        loadSessions();
      } else {
        // Bump session to top of list
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === data.sessionId);
          if (idx === -1) return prev;
          const updated = { ...prev[idx], updatedAt: new Date().toISOString() };
          return [updated, ...prev.filter((_, i) => i !== idx)];
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: data.message,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
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

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // ── Sessions panel ──────────────────────────────────────────────────────────
  const sessionsPanel = (
    <div className="flex flex-col h-full w-full">
      <div className="p-3 border-b">
        <Button onClick={newChat} className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessionsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No chats yet</p>
            <p className="text-xs text-muted-foreground/70">Start a new chat to begin</p>
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => selectSession(session)}
              className={cn(
                "w-full text-left px-3 py-3 border-b flex items-start gap-2 hover:bg-muted/50 transition-colors group",
                session.id === activeSessionId && "bg-muted"
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{session.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(session.updatedAt)}</p>
              </div>
              <button
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive shrink-0 mt-0.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
          ))
        )}
      </div>
    </div>
  );

  // ── Chat area ────────────────────────────────────────────────────────────────
  const chatArea = (
    <div className="flex flex-col h-full">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 border-b px-3 py-2 shrink-0">
        <button
          onClick={() => setShowSessionsOnMobile(true)}
          className="p-1.5 hover:bg-muted rounded-md"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-medium truncate flex-1">
          {activeSession?.title ?? "New Chat"}
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
            <div className="flex gap-3 py-4 px-4 bg-muted/40 rounded-lg">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                B
              </div>
              <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed">
                  Hey! Start by telling me about a transaction, uploading a receipt 📷, or asking me anything about your books.
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
                content={msg.id === streamingId ? streamingText : msg.content}
              />
            ))}
            {loading && (
              <div className="flex gap-3 py-4 px-4 md:px-6 bg-muted/40 items-center">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground flex-1">
                  {thinkingPhrase}
                  <span className="animate-pulse">...</span>
                </p>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                >
                  <Square className="h-3 w-3 fill-current" />
                  Stop
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} onUpload={handleUpload} disabled={loading} />
    </div>
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions panel — desktop: always visible; mobile: toggle */}
      <div
        className={cn(
          "border-r bg-background shrink-0",
          "md:w-56 md:flex md:flex-col",
          showSessionsOnMobile ? "flex flex-col w-full" : "hidden"
        )}
      >
        {sessionsPanel}
      </div>

      {/* Chat area — desktop: always visible; mobile: toggle */}
      <div
        className={cn(
          "flex-1 min-w-0",
          showSessionsOnMobile ? "hidden md:flex md:flex-col" : "flex flex-col"
        )}
      >
        {chatArea}
      </div>
    </div>
  );
}

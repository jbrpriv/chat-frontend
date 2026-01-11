import React, { useState, useEffect, useCallback } from "react";
import API from "../services/api";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

function Chat({ user }) {
  const [targetEmail, setTargetEmail] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [conversationsList, setConversationsList] = useState([]);

  // Fetch all conversations for the user
  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get(`/chat/conversations/${user.id}`);
      setConversationsList(res.data.conversations || []);
    } catch (err) {
      console.error(err.response?.data?.message || "Error fetching conversations");
    }
  }, [user.id]);

  // Start chat with a target user
  const startChat = async () => {
    if (!targetEmail) return alert("Enter an email");
    try {
      const res = await API.post("/chat/start", { userId: user.id, targetEmail });
      setConversation(res.data.conversation);
      setMessages(res.data.messages);
      setTargetEmail("");
      fetchConversations(); // refresh conversation list
    } catch (err) {
      alert(err.response?.data?.message || "Error starting chat");
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!conversation || !text.trim()) return;
    try {
      const receiverId = conversation.participants.find((p) => p !== user.id);
      const res = await API.post("/chat/send", {
        conversationId: conversation._id,
        sender: user.id,
        receiver: receiverId,
        content: text,
      });
      setMessages((prev) => [...prev, res.data.message]);
      socket.emit("sendMessage", res.data.message);
      setText("");
      fetchConversations(); // update last message in conversation list
    } catch (err) {
      alert(err.response?.data?.message || "Error sending message");
    }
  };

  // Listen for incoming messages
  useEffect(() => {
    socket.on("receiveMessage", (msg) => {
      if (conversation && msg.conversationId === conversation._id) {
        setMessages((prev) => [...prev, msg]);
      }
      fetchConversations(); // update conversation list
    });

    return () => socket.off("receiveMessage");
  }, [conversation, fetchConversations]);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Conversations list */}
      <div style={{ width: "200px", border: "1px solid gray", padding: "10px" }}>
        <h3>Chats</h3>
        {conversationsList.map((conv) => (
          <div
            key={conv._id}
            onClick={async () => {
              // Open conversation when clicked
              const res = await API.post("/chat/start", { userId: user.id, targetEmail: conv.participant.email });
              setConversation(res.data.conversation);
              setMessages(res.data.messages);
            }}
            style={{
              cursor: "pointer",
              fontWeight: conv.unread ? "bold" : "normal",
              borderBottom: "1px solid #ccc",
              padding: "5px 0",
            }}
          >
            <div>{conv.participant.email}</div>
            <div style={{ fontSize: "12px", color: "#555" }}>{conv.lastMessage || "No messages yet"}</div>
          </div>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div>
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Target email"
          />
          <button onClick={startChat}>Start Chat</button>
        </div>

        <div
          style={{
            border: "1px solid black",
            height: "300px",
            overflowY: "auto",
            margin: "10px 0",
            padding: "5px",
          }}
        >
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{ textAlign: m.sender === user.id ? "right" : "left" }}
            >
              <span>{m.content}</span>
            </div>
          ))}
        </div>

        <div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type message"
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default Chat;

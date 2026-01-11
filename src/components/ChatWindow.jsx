import React, { useState, useEffect, useRef } from "react";

function ChatWindow({ conversation, currentUserId, onSendMessage }) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  // Helper to format the time (e.g., "10:39 AM")
  const formatTime = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!conversation) {
    return (
      <div className="chat-window">
        <div className="chat-window-empty">
          Select a conversation to start chatting
        </div>
      </div>
    );
  }

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>{conversation.targetEmail}</h3>
      </div>

      <div className="chat-messages">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${
              msg.sender === currentUserId ? "sent" : "received"
            }`}
          >
            {/* The container wraps the bubble and the time together */}
            <div className="message-container">
              <div className="message-bubble">
                {msg.content}
              </div>
              
              {/* Greyed out timestamp underneath */}
              <span className="message-time">
                {formatTime(msg.createdAt)}
              </span>
            </div>
          </div>
        ))}
        {/* Invisible element to anchor scroll to bottom */}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Type a message..."
        />
        <button className="btn-send" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
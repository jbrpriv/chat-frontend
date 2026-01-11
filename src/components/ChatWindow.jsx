import React, { useState, useEffect, useRef } from "react";

// Add 'onBack' to the props list
function ChatWindow({ conversation, currentUserId, onSendMessage, onTyping, isOtherUserTyping, onBack }) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, isOtherUserTyping]);

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

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (onTyping) {
      onTyping(true);
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header" style={{ display: "flex", alignItems: "center" }}>
        {/* Mobile Back Button */}
        <button className="mobile-back-btn" onClick={onBack}>
          &#8592; {/* Left Arrow Icon */}
        </button>
        
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
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
        
        {isOtherUserTyping && (
          <div className="message received">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          value={message}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
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
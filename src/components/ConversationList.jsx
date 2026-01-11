import React from "react";

function ConversationList({ conversations, onSelect, activeEmail }) {
  
  // Helper to format the time from the 'updatedAt' timestamp
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    // Returns format like "10:39 AM"
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="conversation-list">
      <h3>Messages</h3>
      <div className="conversation-list-items">
        {conversations.length === 0 && (
          <div className="no-conversations">No conversations yet</div>
        )}
        
        {conversations.map((conv) => {
          const isUnread = conv.hasUnread;

          return (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.email)}
              className={`conversation-item ${
                activeEmail === conv.email ? "active" : ""
              }`}
            >
              {/* Top Row: Email and Time */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                <span className={`conversation-email ${isUnread ? "unread" : ""}`}>
                  {conv.email}
                </span>
                
                {/* Time: Grey if read, Bold/Black if unread */}
                <span style={{ 
                    fontSize: "11px", 
                    color: isUnread ? "#000" : "#999", 
                    fontWeight: isUnread ? "bold" : "normal",
                    whiteSpace: "nowrap",
                    marginLeft: "8px"
                }}>
                  {formatTime(conv.updatedAt)}
                </span>
              </div>

              {/* Bottom Row: Last Message Preview */}
              <div 
                className="conversation-last-message"
                style={{ 
                  fontWeight: isUnread ? "bold" : "normal",
                  color: isUnread ? "#000" : "#666" 
                }}
              >
                {conv.lastMessage || "No messages yet"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ConversationList;
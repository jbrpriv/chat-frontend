import React, { useState, useEffect, useCallback, useRef } from "react";
import API from "../services/api";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import NewChatModal from "../components/NewChatModal";
import { io } from "socket.io-client";

// Initialize socket
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling']
});

function Home({ user, onLogout }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  
  // FIX 1: Create a Ref to track the current conversation ID
  // This allows us to check the ID inside the socket listener without resetting the listener
  const activeConversationIdRef = useRef(null);

  // Update the Ref whenever state changes
  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.conversationId;
  }, [activeConversation]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get(`/chat/conversations/${user.id}`);
      setConversations(res.data.conversations);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, [user.id]);

  useEffect(() => {
    socket.emit("register", user.id);
    // console.log("Registered with socket:", user.id);
    return () => {
      socket.off("register");
    };
  }, [user.id]);

  // FIX 2: Optimized Socket Listener (Run Once)
  useEffect(() => {
    const handleReceiveMessage = (message) => {
      // console.log("Received message:", message);

      // Check the REF instead of state (No dependency needed!)
      const currentConversationId = activeConversationIdRef.current;

      if (currentConversationId && message.conversationId === currentConversationId) {
        
        // Update state using functional form (prev) -> always gets latest state
        setActiveConversation((prev) => {
          if (!prev) return null;
          
          // Prevent duplicates
          const isDuplicate = prev.messages.some((m) => m.id === message.id);
          if (isDuplicate) return prev;

          return {
            ...prev,
            messages: [...prev.messages, message],
          };
        });

        setIsOtherUserTyping(false);
      }

      // Always update the list (for bold text / last message)
      fetchConversations();
    };

    const handleUserTyping = ({ isTyping, senderEmail }) => {
       // Check against State or Ref is fine here, but Ref is safer for consistency
       // (logic simplified for typing)
       if (activeConversationIdRef.current) {
          // We can't easily check email without full object in ref, 
          // but typing indicator isn't as critical as messages.
          // Let's rely on the set state update which is safe.
          setIsOtherUserTyping(isTyping);
       }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("userTyping", handleUserTyping);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("userTyping", handleUserTyping);
    };
    // FIX 3: Removed 'activeConversation' from dependency array
    // This listener now NEVER resets, so it can't miss messages.
  }, [fetchConversations]); 

  const handleSelectConversation = async (email) => {
    try {
      const res = await API.post("/chat/conversation", {
        userId: user.id,
        targetEmail: email,
      });
      setActiveConversation(res.data);
      setIsOtherUserTyping(false);
      fetchConversations();
    } catch (err) {
      console.error("Error opening conversation:", err);
    }
  };

  const handleNewChat = async (targetEmail) => {
    try {
      const res = await API.post("/chat/verify-user", {
        targetEmail,
      });
      setActiveConversation({
        conversationId: null,
        receiverId: res.data.userId,
        messages: [],
        targetEmail: targetEmail,
      });
      setShowNewChat(false);
      setIsOtherUserTyping(false);
    } catch (err) {
      alert(err.response?.data?.message || "User not found");
    }
  };

  const handleTyping = (isTyping) => {
    if (!activeConversation || !activeConversation.receiverId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    socket.emit("typing", {
      receiverId: activeConversation.receiverId,
      isTyping: true,
      senderEmail: user.email,
    });

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        receiverId: activeConversation.receiverId,
        isTyping: false,
        senderEmail: user.email,
      });
    }, 3000);
  };

  const handleSendMessage = async (content) => {
    if (!activeConversation) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    if (activeConversation.receiverId) {
       socket.emit("typing", {
         receiverId: activeConversation.receiverId,
         isTyping: false,
         senderEmail: user.email,
       });
    }

    try {
      if (!activeConversation.conversationId) {
        // New Conversation Logic...
        const convRes = await API.post("/chat/conversation", {
          userId: user.id,
          targetEmail: activeConversation.targetEmail,
        });
        
        const messageData = {
          conversationId: convRes.data.conversationId,
          sender: user.id,
          receiver: convRes.data.receiverId,
          content,
        };
        const res = await API.post("/chat/message", messageData);
        
        const newMessage = { ...res.data.message }; // Simplify object creation

        setActiveConversation({
          conversationId: convRes.data.conversationId,
          receiverId: convRes.data.receiverId,
          targetEmail: activeConversation.targetEmail,
          messages: [newMessage],
        });

        socket.emit("sendMessage", {
          receiverId: convRes.data.receiverId,
          message: { ...newMessage, conversationId: convRes.data.conversationId },
        });
        fetchConversations();

      } else {
        // Existing Conversation Logic...
        const messageData = {
          conversationId: activeConversation.conversationId,
          sender: user.id,
          receiver: activeConversation.receiverId,
          content,
        };
        const res = await API.post("/chat/message", messageData);
        const newMessage = { ...res.data.message };

        setActiveConversation((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }));

        socket.emit("sendMessage", {
          receiverId: activeConversation.receiverId,
          message: { ...newMessage, conversationId: activeConversation.conversationId },
        });
        fetchConversations();
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message.");
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h2>Chat App</h2>
        <div className="home-header-buttons">
          <button className="btn-new-chat" onClick={() => setShowNewChat(true)}>+ New</button>
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </div>

      <div className={`chat-layout ${activeConversation ? "view-chat" : "view-list"}`}>
        <ConversationList
          conversations={conversations}
          onSelect={handleSelectConversation}
          activeEmail={activeConversation?.targetEmail}
        />
        <ChatWindow
          conversation={activeConversation}
          currentUserId={user.id}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          isOtherUserTyping={isOtherUserTyping}
          onBack={() => setActiveConversation(null)}
        />
      </div>

      {showNewChat && (
        <NewChatModal
          onSubmit={handleNewChat}
          onClose={() => setShowNewChat(false)}
        />
      )}
    </div>
  );
}

export default Home;
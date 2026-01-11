import React, { useState, useEffect, useCallback, useRef } from "react";
import API from "../services/api";
import ConversationList from "../components/ConversationList";
import ChatWindow from "../components/ChatWindow";
import NewChatModal from "../components/NewChatModal";
import { io } from "socket.io-client";

// Initialize socket outside component to prevent multiple connections
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

  // Fetch conversation list from DB
  const fetchConversations = useCallback(async () => {
    try {
      const res = await API.get(`/chat/conversations/${user.id}`);
      setConversations(res.data.conversations);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  }, [user.id]);

  // Register user on socket connection
  useEffect(() => {
    socket.emit("register", user.id);
    console.log("Registered with socket:", user.id);

    return () => {
      socket.off("register");
    };
  }, [user.id]);

  // LISTEN FOR INCOMING MESSAGES AND TYPING
  useEffect(() => {
    const handleReceiveMessage = (message) => {
      console.log("Received message:", message);
      
      // Only update if the message belongs to the currently open conversation
      if (activeConversation && message.conversationId === activeConversation.conversationId) {
        setActiveConversation((prev) => {
          // Check if message with this ID already exists to prevent duplicates
          const isDuplicate = prev.messages.some((m) => m.id === message.id);
          
          if (isDuplicate) {
            return prev; // Do nothing if it's a duplicate
          }

          return {
            ...prev,
            messages: [...prev.messages, message],
          };
        });
        
        // Stop typing indicator when message is received
        setIsOtherUserTyping(false);
      }
      
      // Always refresh the sidebar list to update "Last Message" previews
      fetchConversations();
    };

    const handleUserTyping = ({ isTyping, senderEmail }) => {
      if (activeConversation && senderEmail === activeConversation.targetEmail) {
        setIsOtherUserTyping(isTyping);
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("userTyping", handleUserTyping);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("userTyping", handleUserTyping);
    };
  }, [activeConversation, fetchConversations]);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Open an existing conversation
  const handleSelectConversation = async (email) => {
    try {
      const res = await API.post("/chat/conversation", {
        userId: user.id,
        targetEmail: email,
      });
      setActiveConversation(res.data);
      setIsOtherUserTyping(false); // Reset typing indicator
      fetchConversations();
    } catch (err) {
      console.error("Error opening conversation:", err);
    }
  };

  // Prepare a new chat
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
      setIsOtherUserTyping(false); // Reset typing indicator
    } catch (err) {
      alert(err.response?.data?.message || "User not found");
    }
  };

  // Handle typing indicator
  const handleTyping = (isTyping) => {
    if (!activeConversation || !activeConversation.receiverId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Emit typing event
    socket.emit("typing", {
      receiverId: activeConversation.receiverId,
      isTyping: true,
      senderEmail: user.email,
    });

    // Set timeout to stop typing indicator after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        receiverId: activeConversation.receiverId,
        isTyping: false,
        senderEmail: user.email,
      });
    }, 3000);
  };

  // Send Message Logic
  const handleSendMessage = async (content) => {
    if (!activeConversation) return;

    // Stop typing indicator when sending
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (activeConversation.receiverId) {
      socket.emit("typing", {
        receiverId: activeConversation.receiverId,
        isTyping: false,
        senderEmail: user.email,
      });
    }

    try {
      // Scenario A: First message in a new conversation
      if (!activeConversation.conversationId) {
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

        const newMessage = {
          id: res.data.message.id,
          sender: res.data.message.sender,
          receiver: res.data.message.receiver,
          content: res.data.message.content,
          createdAt: res.data.message.createdAt,
        };

        setActiveConversation({
          conversationId: convRes.data.conversationId,
          receiverId: convRes.data.receiverId,
          targetEmail: activeConversation.targetEmail,
          messages: [newMessage],
        });

        socket.emit("sendMessage", {
          receiverId: convRes.data.receiverId,
          message: {
            ...newMessage,
            conversationId: convRes.data.conversationId,
          },
        });

        fetchConversations();
      } 
      // Scenario B: Existing conversation
      else {
        const messageData = {
          conversationId: activeConversation.conversationId,
          sender: user.id,
          receiver: activeConversation.receiverId,
          content,
        };

        const res = await API.post("/chat/message", messageData);

        const newMessage = {
          id: res.data.message.id,
          sender: res.data.message.sender,
          receiver: res.data.message.receiver,
          content: res.data.message.content,
          createdAt: res.data.message.createdAt,
        };

        // Optimistically update UI (prevent duplicate by checking)
        setActiveConversation((prev) => {
          const isDuplicate = prev.messages.some((m) => m.id === newMessage.id);
          
          if (isDuplicate) {
            return prev;
          }

          return {
            ...prev,
            messages: [...prev.messages, newMessage],
          };
        });

        socket.emit("sendMessage", {
          receiverId: activeConversation.receiverId,
          message: {
            ...newMessage,
            conversationId: activeConversation.conversationId,
          },
        });

        fetchConversations();
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h2>Chat App - {user.email}</h2>
        <div className="home-header-buttons">
          <button className="btn-new-chat" onClick={() => setShowNewChat(true)}>
            + New Chat
          </button>
          <button className="btn-logout" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="chat-layout">
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
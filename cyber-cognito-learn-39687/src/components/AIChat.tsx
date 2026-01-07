import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageSquare, Send, Mic, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Message = { role: "user" | "assistant"; content: string };

interface EmotionContext {
  facialEmotion: string;
  voiceEmotion: string | null;
  engagement: number;
  attention: number;
}

interface AIChatProps {
  emotionContext?: EmotionContext;
}

export const AIChat = ({ emotionContext }: AIChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        toast({
          title: "Voice input failed",
          description: "Please try again or type your message",
          variant: "destructive",
        });
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [toast]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create emotion-aware system prompt
      const emotionPrompt = emotionContext ? 
        `User's current state: Facial emotion: ${emotionContext.facialEmotion}, Voice emotion: ${emotionContext.voiceEmotion || 'unknown'}, Engagement: ${emotionContext.engagement}%, Attention: ${emotionContext.attention}%. Respond empathetically based on their emotional state.` 
        : '';

      // Try Supabase edge function first
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              messages: [...messages, userMessage],
              emotionContext: emotionContext 
            }),
          }
        );

        if (!response.ok || !response.body) {
          throw new Error("Failed to get response");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        let textBuffer = "";

        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = assistantContent;
                  return newMessages;
                });
              }
            } catch {
              continue;
            }
          }
        }

        // Speak the response
        if (assistantContent) {
          speak(assistantContent);
        }
      } catch (error) {
        // Fallback to local emotion-aware AI
        console.log('Using local AI fallback');
        const aiResponse = generateEmotionAwareResponse(userMessage.content, emotionContext);
        
        setMessages((prev) => [...prev, { role: "assistant", content: aiResponse }]);
        speak(aiResponse);
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  // Local emotion-aware AI response generator
  const generateEmotionAwareResponse = (userInput: string, context?: EmotionContext): string => {
    const lowerInput = userInput.toLowerCase();
    
    // Emotion-based responses
    if (context) {
      const { facialEmotion, engagement, attention } = context;
      
      // Low engagement responses
      if (engagement < 60) {
        const lowEngagementResponses = [
          "I notice your energy might be low. Let's take this step by step! What specific topic would you like to explore?",
          "It's okay to feel distracted sometimes. Let's break this down into smaller, manageable pieces. What's the first thing you'd like to understand?",
          "I'm here to help make this easier for you. How about we start with the basics and build from there?",
        ];
        return lowEngagementResponses[Math.floor(Math.random() * lowEngagementResponses.length)];
      }
      
      // Sad emotion responses
      if (facialEmotion === 'sad') {
        const sadResponses = [
          "I can sense this might be challenging for you. Remember, every expert was once a beginner. What would help you feel more confident?",
          "It's completely normal to feel overwhelmed sometimes. You're doing great by reaching out! Let's tackle this together. What's on your mind?",
          "I'm here to support you! Learning can be tough, but you're making progress. How can I help you right now?",
        ];
        return sadResponses[Math.floor(Math.random() * sadResponses.length)];
      }
      
      // Happy/High engagement responses
      if (facialEmotion === 'happy' && engagement > 75) {
        const happyResponses = [
          "Your positive energy is amazing! You're really in the zone. Let's keep this momentum going! What would you like to learn next?",
          "I love your enthusiasm! You're doing fantastic. What aspect of this topic interests you most?",
          "Great energy! You're on fire today! Let's dive deeper into something exciting. What catches your interest?",
        ];
        return happyResponses[Math.floor(Math.random() * happyResponses.length)];
      }
    }
    
    // Topic-specific responses
    if (lowerInput.includes('help') || lowerInput.includes('how')) {
      return "I'm here to help! I can assist with: \n• Explaining concepts\n• Study strategies\n• Breaking down complex topics\n• Motivation and encouragement\n\nWhat specifically would you like help with?";
    }
    
    if (lowerInput.includes('math') || lowerInput.includes('calculate')) {
      return "Math is all about practice and understanding patterns! I can help you with:\n• Step-by-step problem solving\n• Concept explanations\n• Practice strategies\n\nWhat math topic are you working on?";
    }
    
    if (lowerInput.includes('science')) {
      return "Science is fascinating! Whether it's physics, chemistry, or biology, I'm here to make it clearer. What scientific concept would you like to explore?";
    }
    
    if (lowerInput.includes('study') || lowerInput.includes('learn')) {
      return "Great question about studying! Effective learning strategies include:\n• Active recall and practice\n• Spaced repetition\n• Breaking topics into chunks\n• Regular breaks\n\nWhat subject are you studying?";
    }
    
    if (lowerInput.includes('thanks') || lowerInput.includes('thank you')) {
      return "You're very welcome! I'm always here to help you succeed. Keep up the great work! 🌟";
    }
    
    // Default response
    return "That's an interesting question! I'm here to help you learn and grow. Could you tell me more about what you're trying to understand, or what subject you're working on? The more details you share, the better I can assist you!";
  };

  return (
    <Card className="glass-card border-primary/20 p-6 h-[600px] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-primary rounded-lg">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <h3 className="text-xl font-display font-bold text-gradient">AI Learning Assistant</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <p>👋 Hi! I'm your AI learning assistant.</p>
            <p className="text-sm mt-2">Ask me anything about your studies!</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-gradient-primary text-white"
                  : "glass-card border border-primary/20"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass-card border border-primary/20 rounded-2xl px-4 py-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleVoiceInput}
          className={`shrink-0 ${isListening ? "bg-primary text-white" : ""}`}
        >
          {isListening ? <Volume2 className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask me anything..."
          className="flex-1 bg-background/50"
          disabled={isLoading}
        />
        <Button
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
          className="shrink-0 bg-gradient-primary"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};

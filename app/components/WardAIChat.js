'use client';

import { useState, useEffect, useRef } from 'react';

// Cluster information
const CLUSTER_INFO = {
  'Sanjivani Area': {
    name: 'Sanjivani College of Engineering',
    nameHi: 'संजीवनी इंजिनिअरिंग कॉलेज',
    description: 'Educational campus area with student population. Common issues include waste management, road conditions, and facility maintenance.',
    commonIssues: ['Campus waste management', 'Road maintenance', 'Water supply', 'Street lighting'],
    landmark: true,
    type: 'college'
  },
  'Main Market': {
    name: 'Main Market',
    nameHi: 'मुख्य बाजार',
    description: 'Commercial hub with high foot traffic. Frequent issues with drainage, garbage, and street vendor management.',
    commonIssues: ['Blocked drains', 'Garbage collection delays', 'Street light maintenance', 'Water stagnation'],
  },
  'Temple Area': {
    name: 'Temple Area',
    nameHi: 'श्री साईबाबा मंदिर परिसर',
    description: 'Religious and tourist area. Needs attention to cleanliness and drainage especially during festival seasons.',
    commonIssues: ['Drainage near temple', 'Cleanliness maintenance', 'Water supply', 'Festival crowd management'],
  },
  'Station Road': {
    name: 'Station Road',
    nameHi: 'स्टेशन रोड',
    description: 'Area near bus stand and transportation hub. Common issues include road damage and drainage.',
    commonIssues: ['Road damage', 'Drainage near station', 'Street lighting', 'Traffic management'],
  },
  'Government Hospital': {
    name: 'Government Hospital',
    nameHi: 'सरकारी रुग्णालय',
    description: 'Healthcare zone requiring special attention to hygiene and waste management.',
    commonIssues: ['Medical waste management', 'Drainage near hospital', 'Cleanliness standards', 'Water supply'],
  },
  'Old Town': {
    name: 'Old Town',
    nameHi: 'जुना शहर',
    description: 'Historic area with aging infrastructure.',
    commonIssues: ['Sewage overflow', 'Old drainage systems', 'Water supply pressure', 'Road conditions'],
  },
  'Industrial Area': {
    name: 'Industrial Area',
    nameHi: 'औद्योगिक वसाहत',
    description: 'Industrial zone with factory workers. Issues include waste management and road conditions.',
    commonIssues: ['Industrial waste', 'Road damage from heavy vehicles', 'Drainage', 'Water supply'],
  },
  'Kopargaon Area': {
    name: 'Kopargaon Area',
    nameHi: 'कोपरगाव परिसर',
    description: 'General residential area in Kopargaon.',
    commonIssues: ['General maintenance', 'Road conditions', 'Drainage', 'Water supply'],
  },
};

const AI_RESPONSES = {
  summary: (ward, stats) => `📊 **${ward.name}**

${ward.description}

**Current Statistics:**
- Total Complaints: ${stats.total || 0}
- Pending: ${stats.pending || 0}
- Resolved: ${stats.resolved || 0}
- Critical: ${stats.critical || 0}

**Common Issues:**
${ward.commonIssues.map(i => `• ${i}`).join('\n')}`,

  priority: (ward, stats) => {
    const pending = stats.pending || 0;
    if (pending === 0) return `✅ **${ward.name}** has no pending complaints! Great work.`;
    if (pending > 10) return `⚠️ **${ward.name}** has ${pending} pending complaints. Priority attention needed!`;
    return `📋 **${ward.name}** has ${pending} pending complaints. Monitoring required.`;
  },

  status: (ward, stats) => `📍 **Ward ${ward.name.split(' - ')[0]} Status:**

Resolution Rate: ${stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%

${stats.critical > 0 ? '🚨 CRITICAL: ' + stats.critical + ' urgent complaints need immediate attention!' : '✅ No critical issues'}

${stats.pending > 0 ? '⏳ ' + stats.pending + ' complaints are being processed.' : '✨ All complaints resolved!'}`,

  help: () => `🤖 **Ward AI Assistant**

I can help you with:
• **"summary"** - Get ward overview
• **"status"** - Check resolution status  
• **"priority"** - See priority complaints
• **"issues"** - List common issues
• **"stats"** - Detailed statistics
• Or ask any question about this ward!`,
};

export default function WardAIChat({ wardId, wardComplaints, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  
  const wardInfo = wardId ? CLUSTER_INFO[wardId] || CLUSTER_INFO['Kopargaon Area'] : null;
  
  // Calculate stats for this ward
  const stats = wardComplaints?.reduce((acc, c) => {
    acc.total++;
    if (['FILED', 'ASSIGNED', 'IN_PROGRESS', 'AWAITING_VERIFICATION'].includes(c.status)) acc.pending++;
    if (['COMPLETED', 'VERIFIED', 'CLOSED'].includes(c.status)) acc.resolved++;
    if (c.priority_score >= 90) acc.critical++;
    return acc;
  }, { total: 0, pending: 0, resolved: 0, critical: 0 }) || { total: 0, pending: 0, resolved: 0, critical: 0 };

  useEffect(() => {
    if (wardInfo) {
      setMessages([
        {
          type: 'ai',
          content: `🙏 Namaste! Welcome to **${wardInfo.name}** AI Assistant.

I have information about complaints and issues in this ward. How can I help you today?

Type **"help"** to see available commands.`,
        },
      ]);
    }
  }, [wardId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateAIResponse = (userMessage) => {
    const msg = userMessage.toLowerCase().trim();
    
    if (msg.includes('summary') || msg.includes('overview')) {
      return AI_RESPONSES.summary(wardInfo, stats);
    }
    if (msg.includes('status')) {
      return AI_RESPONSES.status(wardInfo, stats);
    }
    if (msg.includes('priority') || msg.includes('urgent')) {
      return AI_RESPONSES.priority(wardInfo, stats);
    }
    if (msg.includes('help')) {
      return AI_RESPONSES.help();
    }
    if (msg.includes('stats') || msg.includes('statistics')) {
      return `📈 **Detailed Statistics for ${wardInfo.name}:**

| Metric | Count |
|--------|-------|
| Total Complaints | ${stats.total} |
| Pending | ${stats.pending} |
| Resolved | ${stats.resolved} |
| Critical | ${stats.critical} |
| Resolution Rate | ${stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}% |

${stats.total === 0 ? '📭 No complaints filed in this ward yet!' : ''}`;
    }
    if (msg.includes('issue') || msg.includes('problem')) {
      return `⚠️ **Common Issues in ${wardInfo.name}:**

${wardInfo.commonIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Contact the municipal office to report specific problems.`;
    }
    if (msg.includes('resolved') || msg.includes('complete')) {
      if (stats.resolved === 0) return `📭 No complaints have been resolved in ${wardInfo.name} yet.`;
      return `✅ **${stats.resolved} complaints** have been resolved in ${wardInfo.name}!`;
    }
    if (msg.includes('pending') || msg.includes('waiting')) {
      if (stats.pending === 0) return `🎉 Great news! No pending complaints in ${wardInfo.name}.`;
      return `⏳ **${stats.pending} complaints** are pending in ${wardInfo.name}.`;
    }
    
    // Default response with ward context
    return `I understand you're asking about: "${userMessage}"

For **${wardInfo.name}**:

• Total Complaints: ${stats.total}
• Pending: ${stats.pending}  
• Resolved: ${stats.resolved}
• Critical: ${stats.critical}

Would you like to know about:
• "status" - Current ward status
• "summary" - Full ward overview
• "priority" - Priority issues
• "stats" - Detailed statistics`;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    
    setIsTyping(true);
    
    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));
    
    const response = generateAIResponse(userMessage);
    setMessages(prev => [...prev, { type: 'ai', content: response }]);
    setIsTyping(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!wardInfo) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #FF9933 0%, #138808 100%)',
          color: 'white',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem' }}>
              🤖
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>AI Ward Assistant</div>
              <div style={{ opacity: 0.85, fontSize: '0.85rem' }}>{wardInfo.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          background: '#e0e0e0',
          borderBottom: '1px solid #e0e0e0',
        }}>
          {[
            { label: 'Total', value: stats.total, color: '#333' },
            { label: 'Pending', value: stats.pending, color: '#e74c3c' },
            { label: 'Resolved', value: stats.resolved, color: '#27ae60' },
            { label: 'Critical', value: stats.critical, color: '#c0392b' },
          ].map((stat, i) => (
            <div key={i} style={{ background: 'white', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '0.7rem', color: '#666' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          background: '#f5f5f5',
        }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div style={{
                maxWidth: '80%',
                padding: '12px 16px',
                borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.type === 'user' ? 'linear-gradient(135deg, #FF9933, #e88a2d)' : 'white',
                color: msg.type === 'user' ? 'white' : '#333',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                whiteSpace: 'pre-wrap',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}>
                {msg.type === 'ai' && (
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '4px' }}>🤖 Assistant</div>
                )}
                {msg.content.split('\n').map((line, j) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <div key={j} style={{ fontWeight: 700, marginTop: j > 0 ? '8px' : 0 }}>{line.replace(/\*\*/g, '')}</div>;
                  }
                  if (line.startsWith('|')) {
                    return <div key={j} style={{ fontFamily: 'monospace', fontSize: '0.8rem', marginTop: '4px' }}>{line}</div>;
                  }
                  if (line.startsWith('•') || line.startsWith('📋') || line.startsWith('📊') || line.startsWith('📭') || line.startsWith('⚠️') || line.startsWith('⏳') || line.startsWith('✅') || line.startsWith('🎉') || line.startsWith('📈') || line.startsWith('🤖') || line.startsWith('🚨') || line.startsWith('📍') || line.startsWith('✨') || line.startsWith('🙏')) {
                    return <div key={j} style={{ marginTop: j > 0 ? '8px' : 0 }}>{line}</div>;
                  }
                  return <div key={j}>{line}</div>;
                })}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                background: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0s' }} />
                  <div style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.2s' }} />
                  <div style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 12px',
          borderTop: '1px solid #e0e0e0',
          overflowX: 'auto',
          background: 'white',
        }}>
          {['summary', 'status', 'priority', 'stats'].map(cmd => (
            <button
              key={cmd}
              onClick={() => { setInput(cmd); }}
              style={{
                padding: '6px 12px',
                borderRadius: '16px',
                border: '1px solid #e0e0e0',
                background: 'white',
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                color: '#333',
              }}
            >
              /{cmd}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          gap: '8px',
          background: 'white',
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask about ${wardInfo.name}...`}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '24px',
              border: '1.5px solid #e0e0e0',
              outline: 'none',
              fontSize: '0.9rem',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              border: 'none',
              background: input.trim() ? 'linear-gradient(135deg, #FF9933, #138808)' : '#ccc',
              color: 'white',
              fontSize: '1.2rem',
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ➤
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

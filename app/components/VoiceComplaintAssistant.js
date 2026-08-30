'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { complaints } from '../lib/api';

// Kopargaon locations
const LOCATIONS = [
  { id: 'sanjivani', name: 'Sanjivani College of Engineering', nameHi: 'संजीवनी इंजिनिअरिंग कॉलेज', lat: 19.8895, lng: 74.4815, ward: 'Ward 8' },
  { id: 'main_market', name: 'Main Market', nameHi: 'मुख्य बाजार', lat: 19.8844, lng: 74.4772, ward: 'Ward 1' },
  { id: 'temple', name: 'Shri Saibaba Temple Area', nameHi: 'श्री साईबाबा मंदिर', lat: 19.8831, lng: 74.4756, ward: 'Ward 3' },
  { id: 'station', name: 'Station Road / Bus Stand', nameHi: 'स्टेशन रोड', lat: 19.8862, lng: 74.4798, ward: 'Ward 2' },
  { id: 'hospital', name: 'Government Hospital', nameHi: 'सरकारी रुग्णालय', lat: 19.8870, lng: 74.4780, ward: 'Ward 6' },
  { id: 'old_town', name: 'Old Town', nameHi: 'जुना शहर', lat: 19.8820, lng: 74.4740, ward: 'Ward 5' },
  { id: 'industrial', name: 'Industrial Area', nameHi: 'औद्योगिक वसाहत', lat: 19.8900, lng: 74.4830, ward: 'Ward 8' },
];

// Categories with Hindi/Marathi labels
const CATEGORIES = [
  { id: 'GARBAGE_NOT_COLLECTED', label: 'कचरा संग्रह - Waste & Cleanliness' },
  { id: 'WATER_LOGGING', label: 'पाणी साचणे - Water / Flooding' },
  { id: 'ROAD_DAMAGE', label: 'रस्ते खराब - Roads & Footpaths' },
  { id: 'BLOCKED_SEWAGE', label: 'नाला ब्लॉक - Drains & Sewage' },
  { id: 'STREETLIGHT', label: 'दिवे खराब - Street Lighting' },
  { id: 'OTHER', label: 'इतर - Something Else' },
];

// Questions in Hindi/Marathi for voice interaction
const QUESTIONS = [
  {
    field: 'location',
    questionHi: 'कोणत्या ठिकाणी ही समस्या आहे? मुख्य बाजार, स्टेशन रोड, मंदिर, रुग्णालय, जुना शहर किंवा औद्योगिक वसाहत?',
    questionEn: 'In which area is this issue? Main Market, Station Road, Temple, Hospital, Old Town, or Industrial Area?',
    options: LOCATIONS.map(l => ({ value: l.id, label: l.nameHi }))
  },
  {
    field: 'category',
    questionHi: 'कोणत्या प्रकारची तक्रार आहे? कचरा, पाणी, रस्ते, नाले किंवा दिवे?',
    questionEn: 'What type of complaint is this? Garbage, Water, Roads, Drains, or Street Lights?',
    options: CATEGORIES.map(c => ({ value: c.id, label: c.label }))
  },
  {
    field: 'complaint_text',
    questionHi: 'आता कृपया समस्येचे वर्णन करा. काय झाले आहे?',
    questionEn: 'Now please describe the problem. What happened?',
    type: 'text'
  },
  {
    field: 'ward',
    questionHi: 'आपण कोणत्या वॉर्डमध्ये आहात? एक ते आठ पर्यंत सांगा.',
    questionEn: 'Which ward are you in? Tell a number from one to eight.',
    type: 'number',
    min: 1,
    max: 8
  }
];

export default function VoiceComplaintAssistant({ onComplete, onClose }) {
  const router = useRouter();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    location: '',
    category: '',
    complaint_text: '',
    ward: ''
  });
  const [transcript, setTranscript] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complaintId, setComplaintId] = useState('');
  
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'mr-IN'; // Marathi
      
      recognitionRef.current.onresult = (event) => {
        const results = Array.from(event.results);
        const last = results[results.length - 1];
        const transcriptText = last[0].transcript;
        
        setTranscript(prev => [...prev, { role: 'user', text: transcriptText }]);
        
        // Auto-process when user stops speaking
        if (!last.isFinal) {
          processTranscript(transcriptText);
        }
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Voice error: ${event.error}`);
        setIsListening(false);
      };
    }
    
    // Initialize speech synthesis
    synthRef.current = window.speechSynthesis;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Speak text
  const speak = (text) => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }
      
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'mr-IN';
      utterance.rate = 0.9;
      utterance.pitch = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };
      
      synthRef.current.speak(utterance);
    });
  };

  // Process user transcript
  const processTranscript = (text) => {
    const currentQuestion = QUESTIONS[currentStep];
    const lowerText = text.toLowerCase();
    
    if (currentQuestion.field === 'location') {
      // Match location
      const location = LOCATIONS.find(l => 
        lowerText.includes(l.name.toLowerCase()) || 
        l.nameHi.includes(text) ||
        text.includes(l.id)
      );
      if (location) {
        handleFieldComplete('location', location.id);
      }
    } else if (currentQuestion.field === 'category') {
      // Match category
      const category = CATEGORIES.find(c => 
        lowerText.includes(c.label.toLowerCase().split(' ')[0]) ||
        c.id.toLowerCase().includes(lowerText.split(' ')[0])
      );
      if (category) {
        handleFieldComplete('category', category.id);
      }
    } else if (currentQuestion.field === 'ward') {
      // Match ward number
      const match = text.match(/\d/);
      if (match) {
        const wardNum = parseInt(match[0]);
        if (wardNum >= 1 && wardNum <= 8) {
          handleFieldComplete('ward', `Ward ${wardNum}`);
        }
      }
    }
  };

  // Handle field completion
  const handleFieldComplete = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTranscript(prev => [...prev, { role: 'system', text: `Recorded: ${field} = ${value}` }]);
    nextStep();
  };

  // Move to next step
  const nextStep = async () => {
    if (currentStep < QUESTIONS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      const question = QUESTIONS[next];
      await speak(question.questionHi);
    } else {
      // All questions answered, submit
      await submitComplaint();
    }
  };

  // Start voice call
  const startCall = async () => {
    setIsCallActive(true);
    setCurrentStep(0);
    setFormData({ location: '', category: '', complaint_text: '', ward: '' });
    setTranscript([]);
    setError('');
    
    await speak('नमस्कार! कोपरगाव नागरी सेवा प्लॅटफॉर्मवर आपले स्वागत आहे. मी आपली तक्रार नोंदवण्यात मदत करेन.');
    await new Promise(r => setTimeout(r, 1000));
    
    // Start first question
    const firstQuestion = QUESTIONS[0];
    await speak(firstQuestion.questionHi);
    
    // Start listening
    if (recognitionRef.current) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Stop voice call
  const stopCall = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    setIsCallActive(false);
  };

  // Submit complaint
  const submitComplaint = async () => {
    setSubmitting(true);
    await speak('तक्रार सबमिट होत आहे. कृपया प्रतीक्षा करा.');
    
    const selectedLocation = LOCATIONS.find(l => l.id === formData.location) || LOCATIONS[0];
    
    try {
      const result = await complaints.file({
        complaint_text: formData.complaint_text || 'Voice registered complaint',
        category: formData.category || 'OTHER',
        location: {
          address: selectedLocation.name,
          area: selectedLocation.nameHi,
          ward: formData.ward || selectedLocation.ward,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng
        },
        source: 'voice_call'
      });
      
      if (result?.success && result.complaint?.complaint_id) {
        setComplaintId(result.complaint.complaint_id);
        await speak(`तक्रार यशस्वीरित्या नोंदवली गेली. तक्रार आयडी ${result.complaint.complaint_id} आहे. धन्यवाद!`);
        onComplete?.(result.complaint);
      } else {
        setError('Failed to submit complaint');
        await speak('माफ करा, तक्रार सबमिट करण्यात त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
      }
    } catch (err) {
      console.error('Submit error:', err);
      setError('Error submitting complaint');
      await speak('त्रुटी आली. कृपया पुन्हा प्रयत्न करा.');
    }
    
    setSubmitting(false);
  };

  // Manual input fallback
  const handleManualInput = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #FF9933 0%, #138808 100%)',
          color: 'white',
          padding: '20px',
          borderRadius: '20px 20px 0 0'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '50px', height: '50px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem'
              }}>
                📞
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>AI Voice Assistant</div>
                <div style={{ opacity: 0.8, fontSize: '0.85rem' }}>कोपरगाव नागरी सेवा</div>
              </div>
            </div>
            <button
              onClick={() => { stopCall(); onClose?.(); }}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: 'white',
                width: '36px', height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Call Status */}
        {isCallActive && (
          <div style={{
            padding: '16px',
            background: isListening ? '#e8f5e9' : '#fff3e0',
            textAlign: 'center',
            borderBottom: '1px solid #eee'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: isListening ? '#4caf50' : '#ff9800',
              color: 'white',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600
            }}>
              <span style={{
                width: '10px', height: '10px',
                background: 'white',
                borderRadius: '50%',
                animation: isListening ? 'pulse 1s infinite' : 'none'
              }} />
              {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Waiting...'}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666' }}>
              Step {currentStep + 1} of {QUESTIONS.length}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div style={{
          height: '200px',
          overflow: 'auto',
          padding: '16px',
          background: '#f9f9f9'
        }}>
          {transcript.length === 0 && !isCallActive && (
            <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎙️</div>
              <p>Click "Start Call" to begin voice complaint registration</p>
              <p style={{ fontSize: '0.85rem', marginTop: '8px', color: '#666' }}>
                The AI will ask you questions in Marathi
              </p>
            </div>
          )}
          
          {transcript.map((t, i) => (
            <div
              key={i}
              style={{
                marginBottom: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: t.role === 'user' ? '#e3f2fd' : t.role === 'system' ? '#f5f5f5' : '#fff',
                marginLeft: t.role === 'user' ? '20px' : '0',
                fontSize: '0.9rem'
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#666' }}>
                {t.role === 'user' ? 'You: ' : t.role === 'system' ? '✓ ' : 'AI: '}
              </span>
              {t.text}
            </div>
          ))}
          
          {complaintId && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: '#e8f5e9',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#2e7d32' }}>Complaint Registered!</div>
              <div style={{ fontFamily: 'monospace', marginTop: '4px' }}>{complaintId}</div>
            </div>
          )}
        </div>

        {/* Current Question */}
        {isCallActive && !complaintId && (
          <div style={{
            padding: '16px',
            borderTop: '1px solid #eee'
          }}>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '8px' }}>
              {QUESTIONS[currentStep]?.questionHi}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic' }}>
              {QUESTIONS[currentStep]?.questionEn}
            </div>
          </div>
        )}

        {/* Form Data Preview */}
        {isCallActive && (
          <div style={{
            padding: '12px 16px',
            background: '#f5f5f5',
            borderTop: '1px solid #eee'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px', color: '#666' }}>
              Collected Info:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.8rem' }}>
              <div>📍 Location: {formData.location || '-'}</div>
              <div>🏷️ Category: {formData.category || '-'}</div>
              <div>📝 Complaint: {formData.complaint_text ? 'Yes' : '-'}</div>
              <div>🏘️ Ward: {formData.ward || '-'}</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{
          padding: '20px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          borderTop: '1px solid #eee'
        }}>
          {!isCallActive ? (
            <button
              onClick={startCall}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #FF9933 0%, #138808 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>📞</span> Start Voice Call
            </button>
          ) : (
            <>
              <button
                onClick={stopCall}
                style={{
                  padding: '12px 24px',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                End Call
              </button>
              <button
                onClick={() => nextStep()}
                disabled={currentStep >= QUESTIONS.length - 1}
                style={{
                  padding: '12px 24px',
                  background: currentStep >= QUESTIONS.length - 1 ? '#ccc' : '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '25px',
                  fontWeight: 600,
                  cursor: currentStep >= QUESTIONS.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                Skip →
              </button>
            </>
          )}
        </div>

        {error && (
          <div style={{
            padding: '12px',
            background: '#ffebee',
            color: '#c62828',
            textAlign: 'center',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    </div>
  );
}

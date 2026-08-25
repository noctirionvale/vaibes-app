// /api/generate-quiz-from-notes.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { notes, subject, difficulty, count, userId, vaibeyContext, smartMode } = req.body;
  
  if (!notes || notes.length === 0) {
    return res.status(400).json({ error: 'No notes provided' });
  }

  // Combine all note content
  const combinedContent = notes.map(n => `### ${n.title}\n${n.content}`).join('\n\n---\n\n');

  // ✅ BUILD CONTEXT-AWARE PROMPT
  let contextPrompt = '';
  
  if (vaibeyContext) {
    contextPrompt = `\n\n🧠 USER CONTEXT (from VaibeyContext):\n`;
    
    if (vaibeyContext.notes?.length > 0) {
      contextPrompt += `\nRecent Notes:\n`;
      vaibeyContext.notes.slice(0, 5).forEach(note => {
        contextPrompt += `- ${note.title} (${note.subject}): ${note.content?.substring(0, 150)}...\n`;
      });
    }
    
    if (vaibeyContext.quizHistory?.length > 0) {
      contextPrompt += `\nQuiz Performance:\n`;
      vaibeyContext.quizHistory.slice(0, 3).forEach(quiz => {
        contextPrompt += `- ${quiz.topic}: ${quiz.score}% (${quiz.completed_at})\n`;
      });
    }
    
    if (vaibeyContext.weakAreas?.length > 0) {
      contextPrompt += `\nWeak Areas to Focus On:\n`;
      vaibeyContext.weakAreas.forEach(area => {
        contextPrompt += `- ${area.topic} (avg: ${area.average_score}%)\n`;
      });
    }
  }

  // ✅ SMART MODE: Auto-select best notes
  let smartModeInstructions = '';
  if (smartMode) {
    smartModeInstructions = `\n\n🎯 SMART MODE ACTIVE:\n- Focus on the most important concepts\n- Prioritize topics the user struggles with (from weak areas)\n- Connect questions to their existing knowledge\n- Generate questions that build on what they already know`;
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        thinking: { type: 'disabled' },
        messages: [
          {
            role: 'system',
            content: `You are Vaibey, generating personalized quiz questions from student notes.

YOUR TASK: Generate ${count} ${difficulty} difficulty multiple-choice questions based on the provided notes${subject !== 'General' ? ` for ${subject}` : ''}.
${contextPrompt}
${smartModeInstructions}

RULES:
1. Questions MUST be directly based on the content provided
2. Each question must have 4 options (A, B, C, D)
3. Clearly indicate the correct answer
4. Provide a brief explanation for why the answer is correct
5. Cover the most important concepts from the notes
6. Use ${difficulty} difficulty level: 
   - easy: basic recall, definitions
   - medium: application, understanding
   - hard: analysis, synthesis
7. If user has weak areas, include questions on those topics
8. Connect questions to their existing knowledge when possible

Return ONLY a JSON array with this exact structure:
[
  {
    "question": "What is the function of chlorophyll?",
    "options": ["Absorbs light energy", "Produces glucose", "Releases oxygen", "Absorbs water"],
    "correct_answer": "Absorbs light energy",
    "correct_index": 0,
    "explanation": "Chlorophyll is the pigment that absorbs light energy..."
  }
]

Do not include any additional text, only the JSON array.`
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nNotes to generate questions from:\n\n${combinedContent}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    const data = await response.json();
    let questions = data.choices[0].message.content;
    
    // Parse JSON
    try {
      questions = JSON.parse(questions);
    } catch (e) {
      const jsonMatch = questions.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse AI response');
      }
    }

    res.status(200).json({ 
      success: true, 
      questions,
      context_used: !!vaibeyContext,
      smart_mode: smartMode
    });
    
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate questions from notes',
      details: error.message 
    });
  }
}
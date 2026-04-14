/* AI Suggestions Panel */
.ai-suggestion-card {
  animation: fadeIn 0.4s ease;
  margin-top: 20px;
}

.ai-suggestion-card > div {
  transition: all 0.2s ease;
}

.ai-suggestion-card > div:hover {
  transform: translateX(4px);
}

.ai-dot {
  width: 8px;
  height: 8px;
  background: var(--neon);
  border-radius: 50%;
  display: inline-block;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

import React from 'react';
import { WizardStep, WIZARD_STEPS, WIZARD_LABELS } from '../types';

interface WizardStepperProps {
  currentStep: WizardStep;
  jumpBackToStep?: WizardStep | null;
  onStepClick: (step: WizardStep) => void;
  isPreviousWorkMode?: boolean;
}

const STEP_COLORS = {
  completed: {
    color: '#3b82f6', // solid bright blue
    bg: 'rgba(59, 130, 246, 0.12)',
    glow: 'rgba(59, 130, 246, 0.3)',
  },
  active: {
    color: '#fbbf24', // golden yellow (current phase)
    bg: 'rgba(251, 191, 36, 0.15)',
    glow: 'rgba(251, 191, 36, 0.4)',
  },
  originStep: {
    color: '#fbbf24', // same as active but maybe a bit pulsing or distinct if needed
    bg: 'rgba(251, 191, 36, 0.2)',
    glow: 'rgba(251, 191, 36, 0.6)',
  },
  future: {
    color: '#71717a', // elegant medium gray (zinc-500)
    bg: 'rgba(39, 39, 42, 0.15)',
    glow: 'rgba(0, 0, 0, 0)',
  }
};

const WizardStepper: React.FC<WizardStepperProps> = ({ currentStep, jumpBackToStep, onStepClick, isPreviousWorkMode }) => {
  const currentIdx = WIZARD_STEPS.indexOf(currentStep);
  const jumpBackIdx = jumpBackToStep ? WIZARD_STEPS.indexOf(jumpBackToStep) : -1;

  return (
    <div className="wizard-stepper">
      {WIZARD_STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isOriginatingStep = idx === jumpBackIdx;
        const isCompleted = idx < currentIdx;
        const isFuture = idx > currentIdx;
        const isDashboard = step === 'dashboard';

        const isStepAllowed = !isPreviousWorkMode || (step === 'technical-review' || step === 'final-inspect');

        // Special logic: if we are in a "jumped" state, intermediate steps should stay blue
        const effectivelyCompleted = isStepAllowed && (isCompleted || (jumpBackToStep && idx < jumpBackIdx && idx > currentIdx));
        
        let stepState: keyof typeof STEP_COLORS = 'future';
        if (isDashboard) stepState = 'active';
        else if (!isStepAllowed) stepState = 'future';
        else if (isActive) stepState = 'active';
        else if (isOriginatingStep) stepState = 'originStep';
        else if (effectivelyCompleted) stepState = 'completed';

        const theme = STEP_COLORS[stepState];

        const isHighlighted = (isStepAllowed && (isActive || isOriginatingStep)) || isDashboard;
        const isReallyCompleted = isStepAllowed && effectivelyCompleted && !isHighlighted;
        
        const isClickable = isDashboard;

        return (
          <React.Fragment key={step}>
            {/* Connector line (not before first item) */}
            {idx > 0 && (
              <div 
                className={`wizard-connector ${isReallyCompleted ? 'completed' : isActive ? 'active' : ''}`} 
                style={{
                  background: isReallyCompleted 
                    ? STEP_COLORS.completed.color 
                    : isActive 
                    ? `linear-gradient(90deg, ${STEP_COLORS.completed.color}, ${STEP_COLORS.active.color})`
                    : 'rgba(63, 63, 70, 0.3)',
                  boxShadow: isActive ? `0 0 8px ${STEP_COLORS.active.glow}` : undefined,
                  opacity: isReallyCompleted ? 0.7 : 0.4
                }}
              />
            )}

            {/* Step circle + label */}
            <button
              className={`wizard-step-btn flex-col items-center flex ${isActive ? 'active' : ''} ${isOriginatingStep ? 'originating' : ''} ${isReallyCompleted ? 'completed' : ''} ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'} ${(!isClickable && isFuture) ? 'opacity-30' : ''}`}
              onClick={() => {
                if (isClickable) onStepClick(step);
              }}
              disabled={!isClickable}
              title={WIZARD_LABELS[step]}
            >
              <div 
                className={`wizard-circle transition-all duration-300 ${isOriginatingStep ? 'animate-pulse' : ''}`}
                style={isHighlighted ? {
                  borderColor: theme.color,
                  backgroundColor: theme.bg,
                  color: theme.color,
                  boxShadow: `0 0 15px ${theme.glow}, inset 0 0 10px ${theme.glow}`,
                } : isReallyCompleted ? {
                  borderColor: STEP_COLORS.completed.color,
                  backgroundColor: STEP_COLORS.completed.color,
                  color: '#09090b',
                  boxShadow: `0 0 8px ${STEP_COLORS.completed.glow}`,
                } : {
                  borderColor: 'rgba(82, 82, 91, 0.4)',
                  backgroundColor: STEP_COLORS.future.bg,
                  color: STEP_COLORS.future.color,
                }}
              >
                {isReallyCompleted ? (
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                     <polyline points="20 6 9 17 4 12" />
                   </svg>
                ) : isDashboard ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                  </svg>
                ) : (
                  <span className="wizard-num">{idx}</span>
                )}
              </div>
              <span 
                className="wizard-label transition-colors duration-300"
                style={isHighlighted ? {
                  color: theme.color,
                  textShadow: `0 0 8px ${theme.glow}`,
                  fontWeight: 600,
                } : isReallyCompleted ? {
                  color: 'rgba(156, 163, 175, 0.9)', // slightly dimmed light gray for completed text
                } : {
                  color: 'rgba(113, 113, 122, 0.6)', // muted dark gray for future steps
                }}
              >
                {WIZARD_LABELS[step]}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default WizardStepper;

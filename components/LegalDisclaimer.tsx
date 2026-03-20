/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';

interface LegalDisclaimerProps {
  onAcknowledge: () => void;
}

export default function LegalDisclaimer({ onAcknowledge }: LegalDisclaimerProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    modal.focus();
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div
      className="legal-disclaimer-overlay"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className="legal-disclaimer-content">
        <h3>Please Note</h3>
        <ul>
          <li>
            Make sure you have the necessary rights to any content you upload.
          </li>
          <li>
            Do not generate content that infringes on others' intellectual
            property or privacy rights.
          </li>
          <li>
            Your use of this generative AI service is subject to Google's{' '}
            <a
              href="https://policies.google.com/terms/generative-ai/use-policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Prohibited Use Policy
            </a>
            .
          </li>
          <li>Gemini can make mistakes, so double-check it.</li>
        </ul>
        <button onClick={onAcknowledge}>OK</button>
      </div>
    </div>
  );
}

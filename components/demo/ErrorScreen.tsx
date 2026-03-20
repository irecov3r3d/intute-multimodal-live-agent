/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useLiveAPIContext } from '../../contexts/LiveAPIContext';
import React, { useEffect, useState } from 'react';
import { StreamingLog } from '../../lib/genai-live-client';

export interface ExtendedErrorType {
  code?: number;
  message?: string;
  status?: string;
}

/**
 * A full-screen overlay component that displays error messages.
 * It listens for 'error' events from the Live API client and presents
 * them in a user-friendly format.
 */
export default function ErrorScreen() {
  const { client, disconnect } = useLiveAPIContext();
  const [error, setError] = useState<{ message?: string } | null>(null);

  // Effect to subscribe and unsubscribe from the client's error events.
  useEffect(() => {
    function onError(error: ErrorEvent) {
      console.error(error);
      setError(error);
    }

    client.on('error', onError);

    return () => {
      client.off('error', onError);
    };
  }, [client]);

  // A specific, helpful message for the common resource exhausted error.
  const quotaErrorMessage =
    'Gemini Live API in AI Studio has a limited free quota each day. Come back tomorrow to continue.';

  // Default error message.
  let errorMessage = 'Something went wrong. Please try again.';
  let rawMessage: string | null = error?.message || null;
  let tryAgainOption = true;

  // Check if the error is a quota error and customize the message.
  if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
    errorMessage = quotaErrorMessage;
    rawMessage = null; // Hide the raw technical message for this specific error.
    tryAgainOption = false; // Don't show a "try again" option for quota errors.
  }

  // If there's no error, render nothing.
  if (!error) {
    return <div style={{ display: 'none' }} />;
  }

  return (
    <div className="error-screen">
      <div
        style={{
          fontSize: 48,
        }}
      >
        💔
      </div>
      <div
        className="error-message-container"
        style={{
          fontSize: 22,
          lineHeight: 1.2,
          opacity: 0.5,
        }}
      >
        {errorMessage}
      </div>
      {tryAgainOption ? (
        <button
          className="close-button"
          onClick={() => {
            disconnect();
            setError(null);
          }}
        >
          Close
        </button>
      ) : null}
      {rawMessage ? (
        <div
          className="error-raw-message-container"
          style={{
            fontSize: 15,
            lineHeight: 1.2,
            opacity: 0.4,
          }}
        >
          {rawMessage}
        </div>
      ) : null}
    </div>
  );
}
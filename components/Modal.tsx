/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { ReactNode } from 'react';
import c from 'classnames';

type ModalProps = {
  children?: ReactNode;
  onClose: () => void;
  className?: string;
};

/**
 * A generic, reusable modal component that displays content in a centered overlay.
 * @param children The content to be rendered inside the modal.
 * @param onClose A callback function that is triggered when the close button is clicked.
 * @param className Optional additional CSS classes to apply to the modal container.
 */
export default function Modal({ children, onClose, className }: ModalProps) {
  return (
    <div className="modalShroud">
      <div className={c('modal', className)}>
        <button onClick={onClose} className="modalClose">
          <span className="icon">close</span>
        </button>
        <div className="modalContent">{children}</div>
      </div>
    </div>
  );
}
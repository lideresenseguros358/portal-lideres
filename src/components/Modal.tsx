'use client';

import { useRouter } from 'next/navigation';
import { FaTimes } from 'react-icons/fa';

interface ModalProps {
  children: React.ReactNode;
  title: string;
  onClose?: () => void;
}

export default function Modal({ children, title, onClose }: ModalProps) {
  const router = useRouter();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  };

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        className="standard-modal-container max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">{title}</h2>
          </div>
          <button onClick={handleClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>
        <div className="standard-modal-content">
          {children}
        </div>
      </div>
    </div>
  );
}

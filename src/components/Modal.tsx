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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col my-2">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800">{title}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-700 transition-colors p-1"
          >
            <FaTimes size={20} />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

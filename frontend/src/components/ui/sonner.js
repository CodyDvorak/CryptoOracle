import { Toaster as Sonner } from 'sonner';

export const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--surface)',
          border: '1px solid var(--card-border)',
          color: 'var(--text)',
        },
      }}
      {...props}
    />
  );
};
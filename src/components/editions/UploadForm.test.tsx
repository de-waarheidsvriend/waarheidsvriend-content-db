/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadForm } from './UploadForm';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useUpload hook
const mockUpload = vi.fn();
const mockReset = vi.fn();
vi.mock('@/hooks/useUpload', () => ({
  useUpload: () => ({
    upload: mockUpload,
    isLoading: false,
    error: null,
    data: null,
    progress: 0,
    step: 'uploading',
    reset: mockReset,
  }),
}));

describe('UploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render upload form with all elements', () => {
    render(<UploadForm />);

    expect(screen.getByText('Nieuwe Editie Uploaden')).toBeInTheDocument();
    expect(screen.getByLabelText(/XHTML Export/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PDF Bestand/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload Editie/i })).toBeInTheDocument();
  });

  it('should have disabled submit button when no files are selected', () => {
    render(<UploadForm />);

    const submitButton = screen.getByRole('button', { name: /Upload Editie/i });
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when both files are selected', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const xhtmlInput = screen.getByLabelText(/XHTML Export/i);
    const pdfInput = screen.getByLabelText(/PDF Bestand/i);

    const xhtmlFile = new File(['xhtml content'], 'test.zip', { type: 'application/zip' });
    const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

    await user.upload(xhtmlInput, xhtmlFile);
    await user.upload(pdfInput, pdfFile);

    const submitButton = screen.getByRole('button', { name: /Upload Editie/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('should call upload when form is submitted with both files', async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const xhtmlInput = screen.getByLabelText(/XHTML Export/i);
    const pdfInput = screen.getByLabelText(/PDF Bestand/i);

    const xhtmlFile = new File(['xhtml content'], 'test.zip', { type: 'application/zip' });
    const pdfFile = new File(['pdf content'], 'test.pdf', { type: 'application/pdf' });

    await user.upload(xhtmlInput, xhtmlFile);
    await user.upload(pdfInput, pdfFile);

    const submitButton = screen.getByRole('button', { name: /Upload Editie/i });
    await user.click(submitButton);

    expect(mockUpload).toHaveBeenCalledWith(
      { xhtml: xhtmlFile, pdf: pdfFile },
      expect.any(Object)
    );
  });

  it('should accept only .zip files for XHTML input', () => {
    render(<UploadForm />);

    const xhtmlInput = screen.getByLabelText(/XHTML Export/i);
    expect(xhtmlInput).toHaveAttribute('accept', '.zip');
  });

  it('should accept only .pdf files for PDF input', () => {
    render(<UploadForm />);

    const pdfInput = screen.getByLabelText(/PDF Bestand/i);
    expect(pdfInput).toHaveAttribute('accept', '.pdf');
  });
});

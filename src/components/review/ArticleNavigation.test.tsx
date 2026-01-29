/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArticleNavigation } from './ArticleNavigation';

describe('ArticleNavigation', () => {
  const defaultProps = {
    currentIndex: 2,
    totalCount: 5,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    articleTitle: 'Test Article',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render navigation with article info', () => {
    render(<ArticleNavigation {...defaultProps} />);

    expect(screen.getByText('Artikel 3 van 5')).toBeInTheDocument();
    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ga naar vorig artikel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ga naar volgend artikel/i })).toBeInTheDocument();
  });

  it('should call onPrevious when previous button is clicked', () => {
    render(<ArticleNavigation {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Ga naar vorig artikel/i }));
    expect(defaultProps.onPrevious).toHaveBeenCalledTimes(1);
  });

  it('should call onNext when next button is clicked', () => {
    render(<ArticleNavigation {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /Ga naar volgend artikel/i }));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('should disable previous button on first article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={0} />);

    expect(screen.getByRole('button', { name: /Ga naar vorig artikel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Ga naar volgend artikel/i })).not.toBeDisabled();
  });

  it('should disable next button on last article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={4} />);

    expect(screen.getByRole('button', { name: /Ga naar vorig artikel/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Ga naar volgend artikel/i })).toBeDisabled();
  });

  it('should navigate with left arrow key', () => {
    render(<ArticleNavigation {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(defaultProps.onPrevious).toHaveBeenCalledTimes(1);
  });

  it('should navigate with right arrow key', () => {
    render(<ArticleNavigation {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it('should not navigate left when on first article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={0} />);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(defaultProps.onPrevious).not.toHaveBeenCalled();
  });

  it('should not navigate right when on last article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={4} />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it('should not navigate when typing in an input', () => {
    render(
      <div>
        <ArticleNavigation {...defaultProps} />
        <input data-testid="test-input" />
      </div>
    );

    const input = screen.getByTestId('test-input');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });

    expect(defaultProps.onPrevious).not.toHaveBeenCalled();
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it('should render without article title', () => {
    render(<ArticleNavigation {...defaultProps} articleTitle={undefined} />);

    expect(screen.getByText('Artikel 3 van 5')).toBeInTheDocument();
    expect(screen.queryByText('Test Article')).not.toBeInTheDocument();
  });

  it('should have proper ARIA labels for accessibility', () => {
    render(<ArticleNavigation {...defaultProps} />);

    const prevButton = screen.getByRole('button', { name: /Ga naar vorig artikel/i });
    const nextButton = screen.getByRole('button', { name: /Ga naar volgend artikel/i });

    expect(prevButton).toHaveAttribute('aria-label');
    expect(nextButton).toHaveAttribute('aria-label');
  });

  it('should have status role for article counter', () => {
    render(<ArticleNavigation {...defaultProps} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should display correct counter for first article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={0} />);

    expect(screen.getByText('Artikel 1 van 5')).toBeInTheDocument();
  });

  it('should display correct counter for last article', () => {
    render(<ArticleNavigation {...defaultProps} currentIndex={4} />);

    expect(screen.getByText('Artikel 5 van 5')).toBeInTheDocument();
  });

  it('should ignore other keys that are not arrow keys', () => {
    render(<ArticleNavigation {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'Space' });
    fireEvent.keyDown(window, { key: 'a' });

    expect(defaultProps.onPrevious).not.toHaveBeenCalled();
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });

  it('should not navigate when typing in textarea', () => {
    render(
      <div>
        <ArticleNavigation {...defaultProps} />
        <textarea data-testid="test-textarea" />
      </div>
    );

    const textarea = screen.getByTestId('test-textarea');
    textarea.focus();
    fireEvent.keyDown(textarea, { key: 'ArrowLeft' });
    fireEvent.keyDown(textarea, { key: 'ArrowRight' });

    expect(defaultProps.onPrevious).not.toHaveBeenCalled();
    expect(defaultProps.onNext).not.toHaveBeenCalled();
  });
});

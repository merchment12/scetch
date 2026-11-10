import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
URL.createObjectURL = vi.fn(() => 'blob:test-image');
URL.revokeObjectURL = vi.fn();

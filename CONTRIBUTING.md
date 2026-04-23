# Contributing to ATAYATOKO Marketplace

Thank you for your interest in contributing to ATAYATOKO! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment:
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

---

## Getting Started

### 1. Fork the Repository

Click the "Fork" button at the top right of the repository page.

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/marketpleace-new.git
cd marketpleace-new
```

### 3. Set Up Development Environment

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Start development server
npm run dev
```

### 4. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-you-are-fixing
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Adding tests

---

## Development Workflow

### 1. Make Your Changes

- Write clean, maintainable code
- Follow existing code patterns
- Add comments where necessary
- Update documentation if needed

### 2. Run Quality Checks

Before committing, ensure your code passes all checks:

```bash
# Format code
npm run format

# Run linter
npm run lint

# Type check
npm run typecheck

# Run tests
npm run test:unit

# Build check
npm run build
```

### 3. Commit Your Changes

Use conventional commit format:

```bash
git add .
git commit -m "feat: add new feature description"
```

See [Commit Guidelines](#commit-guidelines) for details.

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

Go to the original repository and click "New Pull Request".

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools
- `ci`: Changes to CI configuration files and scripts
- `build`: Changes that affect the build system or external dependencies

### Examples

✅ **Good:**
```
feat(auth): add Google OAuth login support
fix(purchases): resolve inventory sync issue
docs: update API documentation
refactor(cart): simplify cart calculation logic
test(inventory): add unit tests for stock management
chore: update dependencies
```

❌ **Bad:**
```
fix stuff
update
WIP
asdfgh
```

### Scope

The scope should be the name of the module affected (folder name or component name).

Examples:
- `feat(products): ...`
- `fix(cart): ...`
- `docs(api): ...`

### Description

- Use imperative, present tense: "add" not "added" nor "adds"
- Don't capitalize the first letter
- No period (.) at the end
- Keep it concise (under 72 characters)

---

## Pull Request Process

### Before Submitting

1. ✅ Update documentation if needed
2. ✅ Add tests for new features
3. ✅ Ensure all tests pass
4. ✅ Run linter and formatter
5. ✅ Update CHANGELOG.md (for significant changes)
6. ✅ Rebase on latest main branch

### PR Title

Use conventional commit format for PR title:
```
feat: add payment gateway integration
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manually tested

## Screenshots (if applicable)
Add screenshots to help explain your changes

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally
```

### Review Process

1. Maintainer reviews code
2. Automated checks must pass (CI/CD)
3. At least one approval required
4. Address review comments
5. Merge when approved

---

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid using `any` type - use proper types
- Enable strict mode in tsconfig.json
- Use interfaces for object shapes
- Use enums for fixed sets of values

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

// ❌ Bad
const user: any = { id: '1', name: 'John' };
```

### React

- Use functional components with hooks
- Keep components small and focused
- Use meaningful component names
- Extract reusable logic into custom hooks
- Use Error Boundaries for error handling

```typescript
// ✅ Good
export function UserProfile({ user }: UserProfileProps) {
  return <div>{user.name}</div>;
}

// ❌ Bad - Class components (unless necessary)
class UserProfile extends Component { ... }
```

### Styling

- Use Tailwind CSS utility classes
- Follow mobile-first approach
- Use consistent spacing scale
- Maintain design system consistency

```tsx
// ✅ Good
<div className="p-4 md:p-6 bg-white rounded-xl shadow-sm">

// ❌ Bad - Inline styles
<div style={{ padding: '16px', background: 'white' }}>
```

### Firebase Operations

- Always use try-catch for async operations
- Implement retry mechanism for critical operations
- Use transactions for data consistency
- Handle loading and error states

```typescript
// ✅ Good
import { retryFirebase } from '@/utils/retry';

async function updateProduct(productId: string, data: ProductData) {
  return retryFirebase(
    'updateProduct',
    async () => {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, data);
    }
  );
}

// ❌ Bad - No error handling
async function updateProduct(productId: string, data: ProductData) {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, data);
}
```

### Error Handling

- Remove console.error from production code
- Use notify system for user feedback
- Log errors to Sentry for monitoring
- Provide user-friendly error messages

```typescript
// ✅ Good
try {
  await updateProduct(id, data);
  notify.success('Product updated successfully');
} catch (error: any) {
  notify.error(error.message || 'Failed to update product');
}

// ❌ Bad
try {
  await updateProduct(id, data);
} catch (error) {
  console.error(error);
}
```

---

## Testing Guidelines

### Unit Tests

- Write tests for all new functions and components
- Aim for >70% code coverage
- Test edge cases and error scenarios
- Use descriptive test names

```typescript
// ✅ Good
describe('calculateTotal', () => {
  it('should calculate total with tax', () => {
    const result = calculateTotal(100, 0.1);
    expect(result).toBe(110);
  });

  it('should handle zero amount', () => {
    const result = calculateTotal(0, 0.1);
    expect(result).toBe(0);
  });
});
```

### E2E Tests

- Test critical user flows
- Test authentication flows
- Test payment processes
- Test admin operations

---

## Documentation

### Code Comments

- Comment complex logic
- Use JSDoc for functions
- Explain "why" not "what"

```typescript
/**
 * Calculate average cost using weighted moving average method
 * @param currentStock - Current stock quantity
 * @param currentCost - Current cost per unit
 * @param incomingQty - Incoming quantity
 * @param incomingCost - Incoming cost per unit
 * @returns New average cost per unit
 */
function calculateAverageCost(
  currentStock: number,
  currentCost: number,
  incomingQty: number,
  incomingCost: number
): number {
  // Implementation...
}
```

### README Updates

Update README.md when:
- Adding new features
- Changing setup process
- Adding new dependencies
- Modifying configuration

---

## Need Help?

- Check existing issues and PRs
- Read documentation in `/docs` folder
- Ask questions in discussions
- Contact maintainers

---

## Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to ATAYATOKO! 🎉

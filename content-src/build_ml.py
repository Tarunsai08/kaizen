"""Machine Learning & Deep Learning — intensive roadmap (math + code).

Structure: Module -> Topic -> Lesson. Every lesson aims for four kinds of resource:
  learn     – intuition first (StatQuest, 3Blue1Brown, MLU-Explain, Jay Alammar, colah)
  deep      – the mathematics (MML book, d2l.ai, Deep Learning book, CS229 notes, Bishop PRML, ISLP, papers)
  implement – build it in code (d2l from-scratch sections, Karpathy's Zero to Hero, scikit-learn / PyTorch docs)
  practice  – a concrete exercise (derive / implement from scratch / Deep-ML problems)
All specific URLs were checked on 2026-09-25 against the live indexes: statquest.org/video_index.html, d2l.ai TOC,
deeplearningbook.org, cs231n.github.io, mlu-explain.github.io, karpathy/nn-zero-to-hero, lilianweng.github.io/archives,
jalammar.github.io, colah.github.io, explained.ai, spinningup.openai.com. Videos without a fixed URL use YouTube search.
"""
import json, os
from urllib.parse import quote_plus

HERE = os.path.dirname(__file__)

def R(title, url, kind, medium, note=None):
    r = {'title': title, 'url': url, 'kind': kind, 'medium': medium}
    if note: r['note'] = note
    return r
def sq(vid, title):  # StatQuest
    return R(f'StatQuest: {title}', f'https://youtu.be/{vid}', 'learn', 'video')
def b3(title, playlist=None):  # 3Blue1Brown
    if playlist:
        return R(f'3Blue1Brown: {title}', f'https://www.youtube.com/playlist?list={playlist}', 'learn', 'video')
    return R(f'3Blue1Brown: {title}', 'https://www.youtube.com/results?search_query=' + quote_plus('3Blue1Brown ' + title), 'learn', 'video')
LA_PL = 'PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab'
CALC_PL = 'PLZHQObOWTQDMsr9K-rj53DwVRMYO3t5Yr'
NN_PL = 'PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi'
def d2l(path, title, kind='deep'):
    return R(f'd2l.ai {title}', f'https://d2l.ai/{path}', kind, 'book')
def d2li(path, title):
    return d2l(path, title, 'implement')
def dlb(ch, title):
    return R(f'Deep Learning book (Goodfellow): {title}', f'https://www.deeplearningbook.org/contents/{ch}.html', 'deep', 'book')
MML = R('Mathematics for Machine Learning (Deisenroth et al.) — free PDF', 'https://mml-book.github.io/book/mml-book.pdf', 'deep', 'book')
def mml(ch):
    return R(f'MML book, chapter {ch}', 'https://mml-book.github.io/book/mml-book.pdf', 'deep', 'book', f'Read chapter {ch}')
def cs229(part):
    return R(f'Stanford CS229 notes (Ng & Ma): {part}', 'https://cs229.stanford.edu/main_notes.pdf', 'deep', 'book', part)
def bishop(ch):
    return R(f'Bishop PRML: {ch}', 'https://www.microsoft.com/en-us/research/wp-content/uploads/2006/01/Bishop-Pattern-Recognition-and-Machine-Learning-2006.pdf', 'deep', 'book', ch)
def islp(ch):
    return R(f'ISLP (Intro to Statistical Learning, Python): {ch}', 'https://www.statlearning.com/', 'deep', 'book', ch)
def mlu(slug, title):
    return R(f'MLU-Explain: {title}', f'https://mlu-explain.github.io/{slug}/', 'learn', 'interactive')
def c231(slug, title, kind='deep'):
    return R(f'CS231n notes: {title}', f'https://cs231n.github.io/{slug}/', kind, 'course')
KARP = {1: ('VMj-3S1tku0', 'micrograd: backprop from scratch'), 2: ('PaCmpygFfXo', 'makemore 1: bigram language model'),
        3: ('TCH_1BHY58I', 'makemore 2: MLP'), 4: ('P6sfmUTpUmc', 'makemore 3: activations, gradients, BatchNorm'),
        5: ('q8SA3rM6ckI', 'makemore 4: becoming a backprop ninja'), 6: ('t3YJ5hKiMQ0', 'makemore 5: WaveNet'),
        7: ('kCc8FmEb1nY', "Let's build GPT from scratch"), 8: ('zduSFxRajkE', "Let's build the GPT tokenizer")}
def karp(n):
    vid, t = KARP[n]
    return R(f'Karpathy Zero to Hero #{n}: {t}', f'https://www.youtube.com/watch?v={vid}', 'implement', 'video')
def lw(slug, title):
    return R(f"Lilian Weng: {title}", f'https://lilianweng.github.io/posts/{slug}/', 'deep', 'article')
def jal(slug, title):
    return R(f'Jay Alammar: {title}', f'https://jalammar.github.io/{slug}/', 'learn', 'article')
def colah(slug, title):
    return R(f'colah: {title}', f'https://colah.github.io/posts/{slug}/', 'learn', 'article')
def expl(slug, title):
    return R(f'explained.ai: {title}', f'https://explained.ai/{slug}/index.html', 'deep', 'article')
def skl(page, title):
    return R(f'scikit-learn guide: {title}', f'https://scikit-learn.org/stable/modules/{page}.html', 'implement', 'article')
def arx(aid, title):
    return R(f'Paper: {title}', f'https://arxiv.org/abs/{aid}', 'deep', 'paper')
def spin(path, title, kind='deep'):
    return R(f'OpenAI Spinning Up: {title}', f'https://spinningup.openai.com/en/latest/{path}.html', kind, 'course')
def yt(q, title=None, kind='learn'):
    return R(title or f'Videos: {q}', 'https://www.youtube.com/results?search_query=' + quote_plus(q), kind, 'video')
def ex(text):
    return R(f'Exercise: {text}', '', 'practice', 'exercise')
def dml(q):
    return R(f'Deep-ML: solve problems on “{q}”', 'https://www.deep-ml.com/problems', 'practice', 'problem', f'Filter/search for “{q}”')
def app(title, url, medium='article'):
    return R(title, url, 'apply', medium)
MIT1806 = R('MIT 18.06 Linear Algebra (Gilbert Strang) — lectures', 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/', 'deep', 'course')
SEEING = R('Seeing Theory (Brown) — interactive probability & stats', 'https://seeing-theory.brown.edu/', 'learn', 'interactive')
BOYD = R('Boyd & Vandenberghe: Convex Optimization (free PDF)', 'https://web.stanford.edu/~boyd/cvxbook/', 'deep', 'book')
SUTTON = R('Sutton & Barto: Reinforcement Learning, 2nd ed. (free PDF)', 'http://incompleteideas.net/book/RLbook2020.pdf', 'deep', 'book')
MATCALC = expl('matrix-calculus', 'The Matrix Calculus You Need for Deep Learning')
UDL = R('Understanding Deep Learning (Simon Prince) — free book + notebooks', 'https://udlbook.github.io/udlbook/', 'deep', 'book')
ANNOT = R('The Annotated Transformer (Harvard NLP) — paper + code line by line', 'https://nlp.seas.harvard.edu/annotated-transformer/', 'implement', 'code')
HF = lambda ch, t: R(f'Hugging Face LLM course: {t}', f'https://huggingface.co/learn/llm-course/chapter{ch}/1', 'implement', 'course')
CS224N = R('Stanford CS224N (NLP with Deep Learning) lectures', 'https://www.youtube.com/playlist?list=PLoROMvodv4rOaMFbaqxPDoLWjDaRAdP9D', 'deep', 'video')
MLIB = R('Chip Huyen: ML Interviews Book', 'https://huyenchip.com/ml-interviews-book/', 'practice', 'book')
PT = lambda path, t: R(f'PyTorch tutorial: {t}', f'https://docs.pytorch.org/tutorials/{path}.html', 'implement', 'article')

def L(id, title, summary, resources, recall, difficulty=None):
    n = {'id': 'ml.' + id, 'title': title, 'summary': summary, 'resources': resources, 'recall': recall}
    if difficulty: n['difficulty'] = difficulty
    return n
def T(id, title, summary, lessons):
    return {'id': 'ml.' + id, 'title': title, 'summary': summary, 'children': lessons}
def M(id, title, summary, topics, resources=None):
    m = {'id': 'ml.' + id, 'title': title, 'summary': summary, 'children': topics}
    if resources: m['resources'] = resources
    return m

modules = []

# ───────────────────────── 1. Linear algebra
modules.append(M('la', 'Math 1 · Linear algebra', 'The language of ML: data are vectors, models are matrices, learning is geometry.', [
  T('la.vec', 'Vectors, matrices & linear maps', 'Think of a matrix as a transformation, not a grid of numbers.', [
    L('la.vec.basics', 'Vectors, span, basis & linear independence', 'Vectors as arrows and lists; linear combinations; span; basis; dimension.',
      [b3('Essence of linear algebra (playlist)', LA_PL), mml(2), d2l('chapter_preliminaries/linear-algebra.html', '2.3 Linear Algebra'), MIT1806, ex('Show that {(1,2),(2,4)} is dependent and {(1,2),(0,1)} is a basis of R²')],
      'What does it mean for vectors to be linearly independent? What is the span of two non-parallel vectors in R³?'),
    L('la.vec.matmul', 'Matrix multiplication as composition', 'Columns tell you where basis vectors land; AB means “apply B, then A”.',
      [b3('Matrix multiplication as composition'), sq('ZTt9gsGcdDo', 'Essential matrix algebra for neural networks'), d2l('chapter_appendix-mathematics-for-deep-learning/geometry-linear-algebraic-ops.html', '22.1 Geometry & linear algebraic ops'), ex('Implement matmul with three loops in Python, then vectorise with NumPy and time both'), dml('matrix-vector dot product')],
      'Why is matrix multiplication not commutative, geometrically? What shape is (m×n)(n×p)?'),
    L('la.vec.dot', 'Dot products, norms, projections & cosine similarity', 'Dot product = length × length × cos θ; projections underlie least squares and attention.',
      [b3('Dot products and duality'), sq('e9U0QAFbfLI', 'Cosine similarity'), mml(3), ex('Derive the projection of b onto a: (aᵀb / aᵀa)·a')],
      'Write the projection of b onto a. Why do embeddings use cosine similarity rather than Euclidean distance?'),
    L('la.vec.det', 'Determinants, inverses, rank & null space', 'Determinant = volume scaling; rank = output dimension; null space = what gets squashed.',
      [b3('The determinant'), b3('Inverse matrices, column space and null space'), mml(4), MIT1806],
      'If det(A)=0, what happens to space and why can’t you invert A? State the rank–nullity theorem.'),
    L('la.vec.systems', 'Solving linear systems & least squares', 'Ax=b, Gaussian elimination, over-determined systems and the normal equations.',
      [sq('PaFPbb66DxQ', 'Fitting a line — least squares'), mml(3), cs229('Linear regression: normal equations'), ex('Derive θ = (XᵀX)⁻¹Xᵀy by setting the gradient of ‖Xθ−y‖² to zero, then verify with numpy.linalg.lstsq')],
      'Derive the normal equations. Geometrically, why is the least-squares residual orthogonal to the column space?'),
  ]),
  T('la.decomp', 'Eigen-decomposition & SVD', 'The decompositions behind PCA, spectral methods, stability and low-rank models.', [
    L('la.decomp.eig', 'Eigenvalues & eigenvectors', 'Directions a matrix only stretches; diagonalisation; symmetric matrices have orthogonal eigenvectors.',
      [b3('Eigenvectors and eigenvalues'), d2l('chapter_appendix-mathematics-for-deep-learning/eigendecomposition.html', '22.2 Eigendecompositions'), mml(4), sq('bv9agba7blc', 'PCA eigenvectors'), ex('Compute eigenpairs of [[2,1],[1,2]] by hand and verify with numpy.linalg.eigh')],
      'Define eigenvector. Why does repeated multiplication by A align a vector with the dominant eigenvector (power iteration)?'),
    L('la.decomp.svd', 'Singular value decomposition (SVD)', 'A = UΣVᵀ for any matrix: rotate, scale, rotate. Low-rank approximation (Eckart–Young).',
      [mml(4), yt('Steve Brunton singular value decomposition', 'Steve Brunton: SVD lecture series'), MIT1806, ex('Compress a grayscale image with rank-k SVD; plot error vs k')],
      'How do SVD and eigen-decomposition of AᵀA relate? Why is truncated SVD the best rank-k approximation?'),
    L('la.decomp.psd', 'Positive-definite matrices, quadratic forms & covariance', 'xᵀAx, PSD matrices, covariance matrices and why Hessians matter.',
      [mml(4), dlb('linear_algebra', 'Ch. 2 Linear Algebra'), ex('Show that any covariance matrix XᵀX/n is positive semi-definite')],
      'Why is a covariance matrix always PSD? What does a positive-definite Hessian tell you about a critical point?'),
  ]),
], [MML, R('Essence of linear algebra', f'https://www.youtube.com/playlist?list={LA_PL}', 'learn', 'video')]))

# ───────────────────────── 2. Calculus & optimisation
modules.append(M('calc', 'Math 2 · Calculus & optimization', 'Gradients are how models learn. Master derivatives of vectors and matrices, then the algorithms that follow them downhill.', [
  T('calc.diff', 'Differential calculus', 'From slopes to gradients, Jacobians and the chain rule that powers backprop.', [
    L('calc.diff.deriv', 'Derivatives & the chain rule', 'Derivative as sensitivity; product, quotient and chain rules.',
      [b3('Essence of calculus (playlist)', CALC_PL), sq('wl1myxrtQHQ', 'The chain rule'), d2l('chapter_preliminaries/calculus.html', '2.4 Calculus'), d2l('chapter_appendix-mathematics-for-deep-learning/single-variable-calculus.html', '22.3 Single-variable calculus')],
      'Differentiate σ(x)=1/(1+e^{-x}) and show σ′ = σ(1−σ).'),
    L('calc.diff.multi', 'Partial derivatives, gradients, Jacobians & Hessians', 'Gradient points uphill; Jacobian stacks gradients; Hessian captures curvature.',
      [d2l('chapter_appendix-mathematics-for-deep-learning/multivariable-calculus.html', '22.4 Multivariable calculus'), mml(5), MATCALC, ex('Compute ∇ of f(x)=xᵀAx and show it equals (A+Aᵀ)x')],
      'What is the gradient of xᵀAx? Of ‖Ax−b‖²? What does the Hessian tell you that the gradient doesn’t?'),
    L('calc.diff.matrix', 'Matrix calculus for deep learning', 'Derivatives w.r.t. vectors and matrices; shapes; the identities you use in every backward pass.',
      [MATCALC, mml(5), c231('optimization-2', 'Backpropagation, intuitions'), ex('Derive ∂L/∂W for L = ‖XW − Y‖²_F and check it with finite differences')],
      'For Y = XW, if you know ∂L/∂Y, what are ∂L/∂W and ∂L/∂X (with shapes)?'),
    L('calc.diff.autodiff', 'Automatic differentiation & computational graphs', 'Forward vs reverse mode; why reverse mode (backprop) is cheap for scalar losses.',
      [d2li('chapter_preliminaries/autograd.html', '2.5 Automatic differentiation'), colah('2015-08-Backprop', 'Calculus on computational graphs'), karp(1), ex('Build micrograd yourself (a scalar autograd engine) following Karpathy #1')],
      'Why is reverse-mode autodiff efficient when you have millions of inputs and one scalar output?'),
    L('calc.diff.integral', 'Integrals & expectations', 'Integration as accumulation; expectations of continuous variables; Monte Carlo estimates.',
      [d2l('chapter_appendix-mathematics-for-deep-learning/integral-calculus.html', '22.5 Integral calculus'), sq('OSPr6G6Ka-U', 'Expected values for continuous variables'), b3('Integration and the fundamental theorem of calculus')],
      'Write E[f(X)] for a continuous X. How would you estimate it with samples?'),
  ]),
  T('calc.opt', 'Optimization', 'From convexity to Adam: how and why training converges (or doesn’t).', [
    L('calc.opt.convex', 'Convexity, critical points & constrained optimization', 'Convex sets/functions, local vs global minima, saddle points, Lagrange multipliers & KKT.',
      [d2l('chapter_optimization/convexity.html', '12.2 Convexity'), d2l('chapter_optimization/optimization-intro.html', '12.1 Optimization and deep learning'), BOYD, mml(7), ex('Use a Lagrange multiplier to maximise xy subject to x+y=10')],
      'Why does convexity guarantee any local minimum is global? What role do Lagrange multipliers play in SVMs?'),
    L('calc.opt.gd', 'Gradient descent & learning rates', 'Update rule, step size, convergence on quadratics, condition number.',
      [sq('sDv4f4s2SB8', 'Gradient descent'), d2l('chapter_optimization/gd.html', '12.3 Gradient descent'), dlb('numerical', 'Ch. 4 Numerical computation'), ex('Implement GD for linear regression in NumPy; plot loss for lr = 0.001, 0.01, 0.1, 1')],
      'Why does too large a learning rate diverge? How does the condition number of the Hessian slow GD?'),
    L('calc.opt.sgd', 'Stochastic & mini-batch SGD', 'Noisy gradients, batch size trade-offs, why SGD generalises.',
      [sq('vMh0zPT0tLI', 'Stochastic gradient descent'), d2l('chapter_optimization/sgd.html', '12.4 SGD'), d2l('chapter_optimization/minibatch-sgd.html', '12.5 Minibatch SGD'), c231('optimization-1', 'Optimization: SGD', 'learn')],
      'Is the mini-batch gradient an unbiased estimate of the full gradient? How does batch size affect variance and throughput?'),
    L('calc.opt.adaptive', 'Momentum, RMSProp, Adam & AdamW', 'Momentum as a heavy ball; per-parameter learning rates; bias correction; decoupled weight decay.',
      [d2l('chapter_optimization/momentum.html', '12.6 Momentum'), d2l('chapter_optimization/rmsprop.html', '12.8 RMSProp'), d2l('chapter_optimization/adam.html', '12.10 Adam'), arx('1412.6980', 'Adam (Kingma & Ba)'), arx('1711.05101', 'Decoupled weight decay (AdamW)'), ex('Implement SGD+momentum and Adam from scratch; race them on the Rosenbrock function')],
      'Write Adam’s update equations including bias correction. Why is AdamW different from Adam + L2?'),
    L('calc.opt.sched', 'Learning-rate schedules & second-order ideas', 'Warmup, step/cosine decay, one-cycle; Newton’s method and why it’s rarely used in DL.',
      [d2l('chapter_optimization/lr-scheduler.html', '12.11 Learning-rate scheduling'), dlb('optimization', 'Ch. 8 Optimization for training deep models')],
      'Why do transformers need learning-rate warmup? Why is Newton’s method impractical for a 1B-parameter model?'),
  ]),
], [R('Essence of calculus', f'https://www.youtube.com/playlist?list={CALC_PL}', 'learn', 'video'), MATCALC]))

# ───────────────────────── 3. Probability
modules.append(M('prob', 'Math 3 · Probability', 'ML is reasoning under uncertainty. Learn distributions, Bayes and likelihood deeply.', [
  T('prob.basics', 'Foundations', 'Random variables, rules of probability and Bayes.', [
    L('prob.basics.rv', 'Random variables, PMFs, PDFs & CDFs', 'Discrete vs continuous; joint, marginal and conditional distributions.',
      [SEEING, sq('oI3hZJqXJuc', 'Main ideas behind probability distributions'), d2l('chapter_preliminaries/probability.html', '2.6 Probability and statistics'), d2l('chapter_appendix-mathematics-for-deep-learning/random-variables.html', '22.6 Random variables'), mml(6)],
      'What is the difference between a PDF value and a probability? How do you get a marginal from a joint?'),
    L('prob.basics.bayes', 'Conditional probability & Bayes’ theorem', 'P(A|B), independence, Bayes’ rule, base rates.',
      [sq('_IgyaD7vOOA', 'Conditional probability'), sq('9wCnvr7Xw4E', "Bayes' theorem"), b3("Bayes theorem, the geometry of changing beliefs"), ex('A test is 99% sensitive, 95% specific, prevalence 1%. Compute P(disease | positive)')],
      'State Bayes’ theorem and name each term (prior, likelihood, evidence, posterior). Why do base rates matter?'),
    L('prob.basics.expect', 'Expectation, variance, covariance & correlation', 'Linearity of expectation, variance of sums, covariance matrices.',
      [sq('KLs_7b7SKi4', 'Expected values'), sq('qtaqvPAeEJY', 'Covariance'), sq('xZ_z8KWkhXE', "Pearson's correlation"), mml(6), ex('Prove Var(X+Y) = Var X + Var Y + 2Cov(X,Y)')],
      'Is E[XY] = E[X]E[Y] in general? When is it? What does zero correlation not imply?'),
  ]),
  T('prob.dist', 'Distributions', 'The families you meet everywhere in ML.', [
    L('prob.dist.common', 'Bernoulli, binomial, categorical, Poisson, exponential', 'Where each arises and their means/variances.',
      [sq('J8jNoF-K8E8', 'Binomial distribution'), d2l('chapter_appendix-mathematics-for-deep-learning/distributions.html', '22.8 Distributions'), SEEING],
      'Which distribution models (a) a coin flip, (b) the class of an image, (c) number of emails per hour?'),
    L('prob.dist.gauss', 'The Gaussian & multivariate Gaussian', 'Density, parameters, covariance geometry, conditioning and marginalising Gaussians.',
      [sq('rzFX5NWojp0', 'The normal distribution'), mml(6), bishop('Ch. 2.3 The Gaussian distribution'), ex('Sample from a 2D Gaussian with a given covariance using its Cholesky factor; plot the ellipse')],
      'Write the multivariate Gaussian density. How does the covariance matrix shape the contours?'),
    L('prob.dist.clt', 'Law of large numbers & central limit theorem', 'Why averages concentrate and become normal; why that powers confidence intervals.',
      [sq('YAlJCEDH2uY', 'The central limit theorem'), b3('But what is the Central Limit Theorem?'), SEEING],
      'State the CLT. What is the standard deviation of a sample mean of n i.i.d. variables?'),
    L('prob.dist.expfam', 'Exponential family & conjugate priors', 'A unifying form for common distributions; why GLMs and conjugacy work.',
      [cs229('Generalized linear models & exponential family'), bishop('Ch. 2.4 The exponential family'), mml(6)],
      'Write the exponential-family form and show the Bernoulli fits it. What is a conjugate prior?'),
  ]),
  T('prob.infer', 'Estimation & inference', 'Fitting parameters: MLE, MAP and full Bayesian thinking.', [
    L('prob.infer.mle', 'Maximum likelihood estimation', 'Likelihood vs probability; log-likelihood; MLE for Bernoulli and Gaussian.',
      [sq('pYxNSUDSFH4', 'Probability vs likelihood'), sq('XepXtl9YKwc', 'Maximum likelihood'), sq('Dn6b9fCIUpM', 'MLE for the normal distribution'), d2l('chapter_appendix-mathematics-for-deep-learning/maximum-likelihood.html', '22.7 Maximum likelihood'), ex('Derive the MLE of μ and σ² for a Gaussian')],
      'Derive the MLE for the Bernoulli parameter p. Why do we maximise the log-likelihood rather than the likelihood?'),
    L('prob.infer.map', 'MAP estimation & Bayesian inference', 'Priors as regularisers; posterior predictive; why L2 = Gaussian prior.',
      [bishop('Ch. 1.2 & 3.3 Bayesian linear regression'), mml(8), dlb('ml', 'Ch. 5.6 Bayesian statistics')],
      'Show that MAP with a Gaussian prior on weights equals L2-regularised least squares.'),
    L('prob.infer.sampling', 'Sampling & Monte Carlo methods', 'Sampling from distributions, importance sampling, MCMC intuition.',
      [sq('XLCWeSVzHUU', 'What does it mean to sample from a distribution?'), dlb('monte_carlo', 'Ch. 17 Monte Carlo methods'), ex('Estimate π by Monte Carlo and plot error vs number of samples')],
      'Why does Monte Carlo error shrink like 1/√n? When would you use importance sampling?'),
  ]),
], [MML, SEEING]))

# ───────────────────────── 4. Statistics & information theory
modules.append(M('stat', 'Math 4 · Statistics & information theory', 'Testing ideas with data, and measuring information — the source of every loss function.', [
  T('stat.core', 'Statistics', 'Estimation, uncertainty and hypothesis tests (A/B testing in interviews).', [
    L('stat.core.estimates', 'Sample statistics, standard error & bias', 'Mean/variance estimators; why divide by n−1; standard error.',
      [sq('SzZ6GpcfoQY', 'Estimating mean, variance and standard deviation'), sq('sHRBg6BhKjI', 'Why dividing by N underestimates the variance'), sq('A82brFpdr9g', 'Standard deviation vs standard error'), d2l('chapter_appendix-mathematics-for-deep-learning/statistics.html', '22.10 Statistics')],
      'Why is the sample variance divided by n−1? What is the standard error of the mean?'),
    L('stat.core.hyp', 'Hypothesis testing, p-values & power', 'Null/alternative, p-values, type I/II errors, power, multiple testing.',
      [sq('0oc49DyA3hU', 'Hypothesis testing and the null hypothesis'), sq('vemZtEM63GY', 'p-values explained'), sq('Rsc5znwR5FA', 'Statistical power'), sq('VX_M3tIyiYk', 'Power analysis'), sq('K8LQSvtjcEo', 'FDR and Benjamini-Hochberg'), sq('HDCOUXE3HMM', 'p-hacking')],
      'What exactly does a p-value of 0.03 mean (and not mean)? How do you choose a sample size for an A/B test?'),
    L('stat.core.ci', 'Confidence intervals, t-tests & bootstrapping', 'Intervals, t-tests/ANOVA, bootstrap resampling.',
      [sq('TqOeMYtOc1w', 'Confidence intervals'), sq('NF5_btOaCig', 't-tests and ANOVA'), sq('Xz0x-8-cgaQ', 'Bootstrapping main ideas'), ex('Bootstrap a 95% CI for the median of a skewed sample in NumPy')],
      'How does the bootstrap estimate uncertainty without formulas? When is a t-test appropriate?'),
  ]),
  T('stat.info', 'Information theory', 'Entropy, cross-entropy and KL — why classification uses log loss.', [
    L('stat.info.entropy', 'Entropy & mutual information', 'Information as surprise; entropy as expected surprise; mutual information.',
      [sq('YtebGVx-Fxw', 'Entropy'), sq('eJIp_mgVLwE', 'Mutual information'), colah('2015-09-Visual-Information', 'Visual information theory'), d2l('chapter_appendix-mathematics-for-deep-learning/information-theory.html', '22.11 Information theory')],
      'Compute the entropy of a fair coin and a 90/10 coin. What does mutual information measure?'),
    L('stat.info.ce', 'Cross-entropy & KL divergence', 'H(p,q) = H(p) + KL(p‖q); why minimising cross-entropy = maximising likelihood.',
      [colah('2015-09-Visual-Information', 'Visual information theory'), sq('6ArSys5qHAU', 'Cross entropy'), dlb('prob', 'Ch. 3 Probability & information theory'), b3('Why “probability of 0” does not mean “impossible”'), ex('Show that minimising cross-entropy with one-hot targets equals maximising log-likelihood')],
      'Why is KL divergence not symmetric? Show H(p,q) = H(p) + KL(p‖q).'),
  ]),
]))

# ───────────────────────── 5. ML fundamentals
modules.append(M('fund', 'ML fundamentals', 'The core concepts every model shares: the learning problem, generalisation, evaluation and data.', [
  T('fund.setup', 'The learning problem', 'What it means to learn from data.', [
    L('fund.setup.intro', 'Supervised, unsupervised & reinforcement learning', 'Task types, features/labels, hypothesis class, loss and risk.',
      [sq('Gv9_4yMHFhI', 'A gentle introduction to machine learning'), dlb('ml', 'Ch. 5 Machine learning basics'), islp('Ch. 2 Statistical learning'), d2l('chapter_introduction/index.html', '1 Introduction', 'learn')],
      'Define empirical risk minimisation. Give one example each of regression, classification, clustering and RL.'),
    L('fund.setup.biasvar', 'Bias–variance trade-off, over/underfitting & double descent', 'Decompose error; model capacity; why huge nets still generalise.',
      [sq('EuBBz3bI-aA', 'Bias and variance'), mlu('bias-variance', 'The bias–variance tradeoff'), mlu('double-descent', 'Double descent (visual)'), mlu('double-descent2', 'Double descent (math)'), cs229('Generalization: bias–variance & double descent'), ex('Derive E[(y−f̂)²] = bias² + variance + noise')],
      'Derive the bias–variance decomposition. What is double descent and why does it challenge the classic U-curve?'),
    L('fund.setup.split', 'Train/validation/test splits & cross-validation', 'Data leakage, k-fold, stratified and time-series splits.',
      [mlu('train-test-validation', 'Train, test & validation sets'), mlu('cross-validation', 'Cross-validation'), sq('fSytzGwwBVw', 'Cross validation'), skl('cross_validation', 'Cross-validation')],
      'Why must the test set be touched only once? How do you cross-validate time-series data?'),
  ]),
  T('fund.eval', 'Evaluation metrics', 'Choosing the right metric is often the real problem.', [
    L('fund.eval.cls', 'Confusion matrix, precision, recall, F1', 'Trade-offs between false positives and false negatives.',
      [sq('Kdsp6soqA7o', 'The confusion matrix'), sq('vP06aMoz4v8', 'Sensitivity and specificity'), mlu('precision-recall', 'Precision & recall'), skl('model_evaluation', 'Model evaluation')],
      'For fraud detection, would you optimise precision or recall? Define F1 and when it misleads.'),
    L('fund.eval.roc', 'ROC–AUC, PR–AUC & calibration', 'Threshold-free metrics; imbalanced data; calibrated probabilities.',
      [sq('4jRBRDbJemM', 'ROC and AUC'), mlu('roc-auc', 'ROC & AUC'), skl('calibration', 'Probability calibration')],
      'What does an AUC of 0.8 mean probabilistically? Why prefer PR-AUC on highly imbalanced data?'),
    L('fund.eval.reg', 'Regression metrics & R²', 'MSE, RMSE, MAE, R², and which loss matches which noise assumption.',
      [sq('2AQKmw14mHM', 'R-squared explained'), skl('model_evaluation', 'Regression metrics')],
      'Why does MSE correspond to Gaussian noise and MAE to Laplacian noise? Can R² be negative?'),
    L('fund.eval.fair', 'Fairness metrics', 'Equality of odds, demographic parity and trade-offs.',
      [mlu('equality-of-odds', 'Equality of odds')],
      'Define equalised odds. Why can’t all fairness criteria be satisfied at once?'),
  ]),
  T('fund.data', 'Data & features', 'Garbage in, garbage out.', [
    L('fund.data.prep', 'Preprocessing: scaling, encoding & missing data', 'Standardisation vs normalisation; one-hot/target encoding; imputation.',
      [sq('589nCGeWG1w', 'One-hot, label, target and k-fold target encoding'), skl('preprocessing', 'Preprocessing data'), skl('impute', 'Imputation of missing values'), d2li('chapter_preliminaries/pandas.html', '2.2 Data preprocessing')],
      'Why should you fit the scaler only on training data? When is target encoding dangerous?'),
    L('fund.data.select', 'Feature engineering & selection; class imbalance', 'Creating signal, selecting features, resampling and class weights.',
      [skl('feature_selection', 'Feature selection'), expl('rf-importance', 'Beware default random-forest importances'), ex('Train a classifier on a 1:99 dataset with and without class weights; compare PR-AUC')],
      'Name three ways to handle class imbalance. Why can impurity-based feature importance mislead?'),
  ]),
]))

# ───────────────────────── 6. Linear models
modules.append(M('lin', 'Classical ML · Linear models', 'The workhorses — and the building blocks of neural networks.', [
  T('lin.reg', 'Linear regression', 'Least squares from three angles: geometry, calculus and probability.', [
    L('lin.reg.ols', 'Ordinary least squares', 'Model, loss, normal equations, gradient descent solution.',
      [sq('7ArmBVF2dCs', 'Linear regression'), sq('zITIFTsivN8', 'Multiple regression'), mlu('linear-regression', 'Linear regression'), cs229('Ch. 1 Linear regression'), d2l('chapter_linear-regression/linear-regression.html', '3.1 Linear regression'), d2li('chapter_linear-regression/linear-regression-scratch.html', '3.4 Linear regression from scratch'), dml('linear regression')],
      'Derive the closed-form OLS solution. Show that OLS is the MLE under Gaussian noise.'),
    L('lin.reg.reg', 'Regularisation: ridge, lasso & elastic net', 'Shrinkage, sparsity, the geometric picture, and the Bayesian view.',
      [sq('Q81RR3yKn30', 'Ridge regression (L2)'), sq('NGf0voTMlcs', 'Lasso regression (L1)'), sq('Xm2C_gTAl8c', 'Ridge vs lasso visualised'), sq('1dKRdX9bfIo', 'Elastic net'), expl('regularization', 'A visual explanation of regularisation'), d2l('chapter_linear-regression/weight-decay.html', '3.7 Weight decay'), skl('linear_model', 'Linear models')],
      'Why does L1 produce exact zeros while L2 doesn’t? Write the ridge closed-form solution.'),
    L('lin.reg.basis', 'Polynomial & basis-function regression', 'Nonlinear features with linear models; overfitting as degree grows.',
      [bishop('Ch. 3.1 Linear basis function models'), islp('Ch. 7 Moving beyond linearity'), ex('Fit polynomials of degree 1–15 to noisy sin(x); plot train vs validation error')],
      'Is polynomial regression a linear model? Why?'),
  ]),
  T('lin.cls', 'Linear classification', 'Logistic regression, softmax and generalised linear models.', [
    L('lin.cls.logreg', 'Logistic regression', 'Sigmoid, log-odds, cross-entropy loss and its gradient.',
      [sq('yIYKR4sgzI8', 'Logistic regression'), sq('vN5cNN2-HWE', 'Logistic regression coefficients'), sq('BfKanl1aSG0', 'Logistic regression and maximum likelihood'), mlu('logistic-regression', 'Logistic regression'), cs229('Ch. 2 Classification and logistic regression'), dml('logistic regression'), ex('Derive ∇ of the log-loss: Xᵀ(σ(Xw) − y); implement logistic regression with GD in NumPy')],
      'Derive the gradient of binary cross-entropy for logistic regression. Why is there no closed form?'),
    L('lin.cls.softmax', 'Softmax regression (multinomial)', 'Softmax, its Jacobian, and categorical cross-entropy.',
      [sq('KpKog-L9veg', 'ArgMax and SoftMax'), sq('M59JElEPgIg', 'The softmax derivative'), d2l('chapter_linear-classification/softmax-regression.html', '4.1 Softmax regression'), d2li('chapter_linear-classification/softmax-regression-scratch.html', '4.4 Softmax regression from scratch'), c231('linear-classify', 'Linear classification: SVM & softmax'), dml('softmax')],
      'Show that ∂L/∂z = softmax(z) − y for cross-entropy with softmax. Why subtract max(z) before exponentiating?'),
    L('lin.cls.glm', 'Generalised linear models & LDA/GDA', 'Link functions; generative vs discriminative classifiers.',
      [cs229('Ch. 3–4 GLMs and generative learning (GDA)'), sq('azXCzI57Yfc', 'Linear discriminant analysis'), bishop('Ch. 4 Linear models for classification')],
      'What is the difference between a generative and a discriminative classifier? When does GDA reduce to logistic regression?'),
    L('lin.cls.perceptron', 'The perceptron', 'The first learning algorithm; convergence on separable data.',
      [cs229('Perceptron algorithm'), dlb('mlp', 'Ch. 6 Deep feedforward networks (intro)'), ex('Implement the perceptron and show it fails on XOR')],
      'State the perceptron update. Why can’t a single perceptron learn XOR?'),
  ]),
]))

# ───────────────────────── 7. Nonlinear classical
modules.append(M('trees', 'Classical ML · Kernels, trees & ensembles', 'The models that still win on tabular data.', [
  T('trees.inst', 'Instance-based & probabilistic', 'Simple but powerful baselines.', [
    L('trees.inst.knn', 'k-nearest neighbours & the curse of dimensionality', 'Distance metrics, choosing k, why high dimensions break distance.',
      [sq('HVXime0nQeI', 'K-nearest neighbors'), c231('classification', 'kNN and data-driven classification'), skl('neighbors', 'Nearest neighbors'), ex('Implement kNN in NumPy with vectorised distances')],
      'How does k trade off bias and variance? Why do all points look equally far apart in 1000 dimensions?'),
    L('trees.inst.nb', 'Naive Bayes', 'Conditional independence assumption; Gaussian and multinomial NB; Laplace smoothing.',
      [sq('O2L2Uv9pdDA', 'Naive Bayes'), sq('H3EjCKtlVog', 'Gaussian naive Bayes'), d2l('chapter_appendix-mathematics-for-deep-learning/naive-bayes.html', '22.9 Naive Bayes'), skl('naive_bayes', 'Naive Bayes')],
      'What is “naive” about naive Bayes? Why is Laplace smoothing needed?'),
  ]),
  T('trees.svm', 'Support vector machines & kernels', 'Max-margin classifiers and the kernel trick.', [
    L('trees.svm.margin', 'Maximum-margin classifiers & the SVM dual', 'Hard/soft margin, hinge loss, Lagrangian dual, support vectors.',
      [sq('efR1C6CvhmE', 'Support vector machines'), cs229('Ch. 6 Support vector machines'), bishop('Ch. 7 Sparse kernel machines'), skl('svm', 'Support vector machines')],
      'Write the soft-margin SVM objective. Why do only support vectors appear in the dual solution?'),
    L('trees.svm.kernel', 'Kernels & the kernel trick', 'Polynomial and RBF kernels; Mercer’s condition; kernel ridge.',
      [sq('Toet3EiSFcM', 'The polynomial kernel'), sq('Qc5IyLW_hns', 'The radial (RBF) kernel'), cs229('Kernel methods'), dml('kernel')],
      'Explain the kernel trick. What feature space does the RBF kernel correspond to?'),
  ]),
  T('trees.trees', 'Decision trees', 'Recursive splitting on impurity.', [
    L('trees.trees.cart', 'Classification & regression trees', 'Gini, entropy, information gain, pruning.',
      [sq('_L39rN6gz7Y', 'Decision and classification trees'), sq('g9c66TUylZ4', 'Regression trees'), sq('D0efHEJsfHo', 'Cost complexity pruning'), mlu('decision-tree', 'Decision trees'), skl('tree', 'Decision trees'), ex('Implement a depth-limited decision tree (Gini) from scratch')],
      'Compute the Gini impurity of a node with 30/70 classes. Why do deep trees overfit?'),
  ]),
  T('trees.ens', 'Ensembles & boosting', 'Combining weak learners — the tabular-data champions.', [
    L('trees.ens.bagging', 'Bagging & random forests', 'Bootstrap aggregation; decorrelating trees; OOB error.',
      [sq('J4Wdy0Wc_xQ', 'Random forests part 1'), sq('mIlw5j3WyVk', 'Random forests part 2'), mlu('random-forest', 'Random forests'), skl('ensemble', 'Ensemble methods')],
      'Why does averaging decorrelated trees reduce variance? What is out-of-bag error?'),
    L('trees.ens.adaboost', 'AdaBoost', 'Re-weighting mistakes; exponential loss.',
      [sq('LsK-xG1cLYA', 'AdaBoost'), bishop('Ch. 14.3 Boosting')],
      'How does AdaBoost update sample weights and learner weights?'),
    L('trees.ens.gbm', 'Gradient boosting', 'Fitting residuals = gradient descent in function space.',
      [sq('3CC4N4z3GJc', 'Gradient boost: regression main ideas'), sq('2xudPOBz-vs', 'Gradient boost: regression details'), sq('jxuNLH5dXCs', 'Gradient boost: classification'), sq('StWY5QWMXCw', 'Gradient boost: classification details'), expl('gradient-boosting', 'How to explain gradient boosting'), ex('Implement gradient boosting for regression using sklearn stumps as base learners')],
      'Why is fitting residuals the same as gradient descent on squared loss? What does the learning rate (shrinkage) do?'),
    L('trees.ens.xgb', 'XGBoost, LightGBM & CatBoost', 'Second-order boosting, regularised trees, histogram splits, ordered target encoding.',
      [sq('OtD8wVaFm6E', 'XGBoost part 1: regression'), sq('8b1JEDvenQU', 'XGBoost part 2: classification'), sq('ZVFeW798-2I', 'XGBoost part 3: math details'), sq('oRrKeUCEbq8', 'XGBoost part 4: optimizations'), sq('KXOTSkPL2X4', 'CatBoost: ordered target encoding'), arx('1603.02754', 'XGBoost'), app('Kaggle Learn: intermediate ML (XGBoost)', 'https://www.kaggle.com/learn/intermediate-machine-learning', 'course')],
      'How does XGBoost use the Hessian when choosing splits? What do λ and γ regularise?'),
  ]),
]))

# ───────────────────────── 8. Unsupervised
modules.append(M('unsup', 'Classical ML · Unsupervised learning', 'Finding structure without labels: clustering, mixtures and dimensionality reduction.', [
  T('unsup.clust', 'Clustering', 'Grouping similar points.', [
    L('unsup.clust.kmeans', 'k-means', 'Lloyd’s algorithm, objective, k-means++, choosing k.',
      [sq('4b5d3muPQmA', 'K-means clustering'), cs229('Ch. 10 k-means'), skl('clustering', 'Clustering'), dml('k-means'), ex('Implement k-means with k-means++ init in NumPy')],
      'What objective does k-means minimise, and why does Lloyd’s algorithm never increase it?'),
    L('unsup.clust.hier', 'Hierarchical clustering & DBSCAN', 'Linkage criteria; density-based clustering for arbitrary shapes.',
      [sq('7xHsRkOdVwo', 'Hierarchical clustering'), sq('RDZUdRSDOok', 'DBSCAN')],
      'When does DBSCAN beat k-means? What do eps and min_samples control?'),
    L('unsup.clust.gmm', 'Gaussian mixtures & the EM algorithm', 'Soft clustering; latent variables; E-step and M-step; ELBO view.',
      [cs229('Ch. 11 EM algorithms'), bishop('Ch. 9 Mixture models and EM'), skl('mixture', 'Gaussian mixture models'), ex('Implement EM for a 1-D mixture of two Gaussians')],
      'Write the E-step and M-step for a GMM. Why is EM guaranteed not to decrease the likelihood?'),
  ]),
  T('unsup.dim', 'Dimensionality reduction', 'Compressing data while keeping what matters.', [
    L('unsup.dim.pca', 'Principal component analysis', 'Variance maximisation, eigenvectors of the covariance, SVD view, explained variance.',
      [sq('FgakZw6K1QQ', 'PCA step by step'), sq('oRvgq966yZg', 'PCA practical tips'), mml(10), cs229('Ch. 12 PCA'), skl('decomposition', 'Matrix decomposition'), dml('PCA'), ex('Implement PCA via SVD and via eigen-decomposition; confirm they match')],
      'Derive PCA as maximising projected variance. Why should you standardise features first?'),
    L('unsup.dim.manifold', 't-SNE, UMAP & MDS', 'Nonlinear embeddings for visualisation; what distances they preserve.',
      [sq('NEaUSP4YerM', 't-SNE'), sq('eN0wFzBA4Sc', 'UMAP main ideas'), sq('jth4kEvJ3P8', 'UMAP mathematical details'), sq('GEn-_dAyYME', 'MDS and PCoA'), colah('2014-10-Visualizing-MNIST', 'Visualizing MNIST'), skl('manifold', 'Manifold learning')],
      'Why shouldn’t you read cluster sizes or distances off a t-SNE plot?'),
    L('unsup.dim.ica', 'ICA & anomaly detection', 'Independent components; isolation forest, one-class SVM, density-based outliers.',
      [cs229('Ch. 13 ICA'), skl('outlier_detection', 'Novelty and outlier detection')],
      'How does ICA differ from PCA? How does an isolation forest score anomalies?'),
  ]),
]))

# ───────────────────────── 9. Deep learning foundations
modules.append(M('dl', 'Deep learning foundations', 'Neural networks from first principles — build every piece yourself, then use PyTorch.', [
  T('dl.nn', 'Neural networks', 'From a neuron to a multilayer perceptron.', [
    L('dl.nn.mlp', 'Neurons, layers & the MLP', 'Affine + nonlinearity; universal approximation; forward pass in matrix form.',
      [b3('Neural networks (playlist)', NN_PL), sq('CqOfi41LfDw', 'Neural networks: the essential main ideas'), mlu('neural-networks', 'Neural networks'), d2l('chapter_multilayer-perceptrons/mlp.html', '5.1 Multilayer perceptrons'), dlb('mlp', 'Ch. 6 Deep feedforward networks'), c231('neural-networks-1', 'NN part 1: architecture')],
      'Why do we need nonlinear activations? What does the universal approximation theorem say (and not say)?'),
    L('dl.nn.backprop', 'Backpropagation', 'Chain rule over the computational graph; vectorised backward pass.',
      [sq('IN2XmBhILt4', 'Backpropagation main ideas'), sq('iyn2zdALii8', 'Backpropagation details 1'), sq('GKZoOHXGcLo', 'Backpropagation details 2'), b3('Backpropagation calculus'), d2l('chapter_multilayer-perceptrons/backprop.html', '5.3 Forward/backward propagation'), c231('optimization-2', 'Backprop intuitions'), karp(1), karp(5), ex('Derive and implement the backward pass of a 2-layer MLP in NumPy; gradient-check it')],
      'Derive the gradients for a 2-layer MLP with ReLU and softmax cross-entropy. What is a gradient check?', 'Core'),
    L('dl.nn.act', 'Activation functions', 'Sigmoid, tanh, ReLU, Leaky ReLU, GELU, SiLU; saturation & dead units.',
      [sq('68BZ5f7P94E', 'ReLU in action'), c231('neural-networks-1', 'Activation functions'), d2l('chapter_multilayer-perceptrons/mlp.html', '5.1.2 Activation functions')],
      'Why does sigmoid cause vanishing gradients? Why did ReLU help, and what is a dead ReLU?'),
    L('dl.nn.loss', 'Loss functions', 'MSE, cross-entropy, hinge, Huber, focal; tying losses to likelihoods.',
      [sq('6ArSys5qHAU', 'Cross entropy'), sq('xBEh66V9gZo', 'Cross-entropy derivatives and backprop'), c231('neural-networks-2', 'NN part 2: data & loss')],
      'Why use cross-entropy instead of MSE for classification? When is Huber loss preferred?'),
    L('dl.nn.init', 'Initialisation & numerical stability', 'Vanishing/exploding gradients; Xavier/Glorot and He/Kaiming initialisation.',
      [d2l('chapter_multilayer-perceptrons/numerical-stability-and-init.html', '5.4 Numerical stability and initialisation'), karp(4), arx('1502.01852', 'Delving deep into rectifiers (He init)')],
      'Derive why He init uses variance 2/fan_in for ReLU. What happens to activations with too-small init?'),
  ]),
  T('dl.train', 'Training deep networks', 'Making optimisation and generalisation work in practice.', [
    L('dl.train.reg', 'Regularisation: weight decay, dropout, early stopping, augmentation', 'Why each works and how they interact.',
      [d2l('chapter_multilayer-perceptrons/dropout.html', '5.6 Dropout'), d2l('chapter_multilayer-perceptrons/generalization-deep.html', '5.5 Generalisation in deep learning'), dlb('regularization', 'Ch. 7 Regularization for deep learning'), R('Paper: Dropout (Srivastava et al., JMLR 2014)', 'https://jmlr.org/papers/v15/srivastava14a.html', 'deep', 'paper')],
      'Why do we scale activations by 1/(1−p) with inverted dropout? How is dropout like an ensemble?'),
    L('dl.train.norm', 'Batch norm & layer norm', 'Normalising activations; train vs eval behaviour; why transformers use LayerNorm.',
      [d2l('chapter_convolutional-modern/batch-norm.html', '8.5 Batch normalization'), karp(4), arx('1502.03167', 'Batch normalization'), arx('1607.06450', 'Layer normalization'), ex('Implement BatchNorm forward & backward in NumPy')],
      'Write BatchNorm’s forward pass. Why does it behave differently at inference? Why LayerNorm for sequences?'),
    L('dl.train.recipe', 'The training recipe & debugging', 'Overfit one batch, learning-rate finders, monitoring, common bugs.',
      [c231('neural-networks-3', 'NN part 3: learning & evaluation'), R('Karpathy: A Recipe for Training Neural Networks', 'https://karpathy.github.io/2019/04/25/recipe/', 'learn', 'article'), dlb('guidelines', 'Ch. 11 Practical methodology'), c231('neural-networks-case-study', 'Minimal NN case study', 'implement')],
      'Your loss isn’t decreasing — list the first five things you check.'),
  ]),
  T('dl.pytorch', 'PyTorch in practice', 'From tensors to training loops and GPUs.', [
    L('dl.pytorch.basics', 'Tensors, autograd & nn.Module', 'Tensors, broadcasting, autograd, modules, parameters.',
      [PT('beginner/basics/intro', 'Learn the basics'), sq('FHdlXe1bSe4', 'Introduction to PyTorch'), d2li('chapter_builders-guide/model-construction.html', '6.1 Layers and modules'), d2li('chapter_builders-guide/parameters.html', '6.2 Parameter management'), sq('L35fFDpwIM4', 'Tensors for neural networks')],
      'What does loss.backward() do, and why must you call optimizer.zero_grad()?'),
    L('dl.pytorch.loop', 'Datasets, training loops & GPUs', 'DataLoader, train/eval modes, checkpoints, mixed precision.',
      [PT('beginner/basics/data_tutorial', 'Datasets & DataLoaders'), PT('beginner/basics/optimization_tutorial', 'Optimizing model parameters'), d2li('chapter_builders-guide/use-gpu.html', '6.7 GPUs'), d2li('chapter_multilayer-perceptrons/kaggle-house-price.html', '5.7 Kaggle house prices'), ex('Train an MLP on Fashion-MNIST to >88% with a hand-written loop')],
      'What does model.eval() change? Why wrap inference in torch.no_grad()?'),
    L('dl.pytorch.lm', 'Build a character-level language model', 'Karpathy’s makemore series — bigrams → MLP → WaveNet.',
      [karp(2), karp(3), karp(6), R('karpathy/nn-zero-to-hero (notebooks)', 'https://github.com/karpathy/nn-zero-to-hero', 'implement', 'code')],
      'How does the MLP language model (Bengio 2003) use embeddings and context windows?'),
  ]),
], [UDL, R('Neural networks: Zero to Hero (Karpathy)', 'https://github.com/karpathy/nn-zero-to-hero', 'implement', 'course')]))

# ───────────────────────── 10. CNNs & vision
modules.append(M('cv', 'Computer vision & CNNs', 'Convolutions, modern architectures and vision tasks.', [
  T('cv.conv', 'Convolutional networks', 'Why convolution suits images.', [
    L('cv.conv.op', 'The convolution operation', 'Locality, weight sharing, padding, stride, channels, receptive field.',
      [sq('HGwBXDKFk9I', 'CNNs for image classification'), b3('But what is a convolution?'), colah('2014-07-Understanding-Convolutions', 'Understanding convolutions'), d2l('chapter_convolutional-neural-networks/why-conv.html', '7.1 From FC layers to convolutions'), d2l('chapter_convolutional-neural-networks/padding-and-strides.html', '7.3 Padding and stride'), c231('convolutional-networks', 'CNN architectures'), ex('Implement conv2d forward with loops, then with im2col; compute output shapes')],
      'Compute the output size for a 32×32 input, 5×5 kernel, stride 2, padding 1. How many parameters does a 3×3×64→128 conv have?'),
    L('cv.conv.pool', 'Pooling, channels & LeNet', 'Multi-channel convolution, pooling and the first CNN.',
      [d2l('chapter_convolutional-neural-networks/channels.html', '7.4 Multiple channels'), d2l('chapter_convolutional-neural-networks/pooling.html', '7.5 Pooling'), d2li('chapter_convolutional-neural-networks/lenet.html', '7.6 LeNet')],
      'What invariance does max-pooling provide? What is a 1×1 convolution for?'),
    L('cv.conv.backprop', 'Backprop through convolutions', 'Gradients of conv layers as convolutions themselves.',
      [dlb('convnets', 'Ch. 9 Convolutional networks'), c231('convolutional-networks', 'Conv layers'), ex('Derive ∂L/∂W for a 1-D convolution and verify numerically')],
      'Show that the gradient w.r.t. a conv input is a (transposed) convolution with the flipped kernel.'),
  ]),
  T('cv.arch', 'Modern architectures', 'AlexNet → VGG → Inception → ResNet → ViT.', [
    L('cv.arch.classic', 'AlexNet, VGG, NiN, GoogLeNet', 'Depth, blocks and multi-branch designs.',
      [d2l('chapter_convolutional-modern/alexnet.html', '8.1 AlexNet'), d2l('chapter_convolutional-modern/vgg.html', '8.2 VGG'), d2l('chapter_convolutional-modern/googlenet.html', '8.4 GoogLeNet')],
      'What made AlexNet work in 2012? Why do VGG’s stacked 3×3 convs beat one 7×7?'),
    L('cv.arch.resnet', 'ResNet & DenseNet', 'Residual connections and why they make very deep nets trainable.',
      [d2l('chapter_convolutional-modern/resnet.html', '8.6 ResNet'), d2l('chapter_convolutional-modern/densenet.html', '8.7 DenseNet'), arx('1512.03385', 'Deep residual learning (ResNet)'), ex('Implement a ResNet-18 block in PyTorch and train on CIFAR-10')],
      'Why do residual connections help gradient flow? What happens if a residual block learns F(x)=0?'),
    L('cv.arch.vit', 'Vision transformers', 'Patches as tokens; when ViTs beat CNNs.',
      [d2l('chapter_attention-mechanisms-and-transformers/vision-transformer.html', '11.8 Transformers for vision'), arx('2010.11929', 'An image is worth 16×16 words (ViT)')],
      'How does ViT turn an image into tokens? Why do ViTs need more data than CNNs?'),
  ]),
  T('cv.tasks', 'Vision tasks', 'Beyond classification.', [
    L('cv.tasks.transfer', 'Transfer learning, fine-tuning & augmentation', 'Reusing pretrained features.',
      [c231('transfer-learning', 'Transfer learning', 'learn'), d2li('chapter_computer-vision/fine-tuning.html', '14.2 Fine-tuning'), d2li('chapter_computer-vision/image-augmentation.html', '14.1 Image augmentation'), R('fast.ai: Practical Deep Learning for Coders', 'https://course.fast.ai/', 'apply', 'course')],
      'When do you freeze the backbone vs fine-tune everything? Which augmentations are unsafe for which tasks?'),
    L('cv.tasks.detect', 'Object detection', 'Anchors, IoU, NMS; R-CNN family, SSD, YOLO.',
      [d2l('chapter_computer-vision/anchor.html', '14.4 Anchor boxes'), d2l('chapter_computer-vision/rcnn.html', '14.8 R-CNNs'), d2l('chapter_computer-vision/ssd.html', '14.7 SSD'), lw('2017-12-31-object-recognition-part-3', 'R-CNN family'), lw('2018-12-27-object-recognition-part-4', 'Fast detection models (YOLO/SSD)'), arx('1506.02640', 'YOLO'), dml('IoU')],
      'Define IoU and non-max suppression. How do one-stage and two-stage detectors differ?'),
    L('cv.tasks.seg', 'Segmentation & dense prediction', 'Transposed convs, FCN, U-Net.',
      [d2l('chapter_computer-vision/transposed-conv.html', '14.10 Transposed convolution'), d2l('chapter_computer-vision/fcn.html', '14.11 Fully convolutional networks'), arx('1505.04597', 'U-Net')],
      'What does a transposed convolution do to spatial size? Why does U-Net use skip connections?'),
    L('cv.tasks.interp', 'Understanding & visualising CNNs', 'Saliency, feature visualisation, adversarial examples.',
      [c231('understanding-cnn', 'Understanding and visualizing CNNs', 'learn'), lw('2017-08-01-interpretation', 'Explaining model predictions')],
      'How is a saliency map computed? What is an adversarial example?'),
  ]),
]))

# ───────────────────────── 11. Sequences
modules.append(M('seq', 'Sequence models & NLP basics', 'Language before transformers: embeddings, RNNs, LSTMs and attention.', [
  T('seq.text', 'Text representation', 'Turning words into vectors.', [
    L('seq.text.tok', 'Tokenisation & language modelling', 'Characters, words, subwords (BPE); n-gram LMs; perplexity.',
      [d2l('chapter_recurrent-neural-networks/text-sequence.html', '9.2 Text to sequences'), d2l('chapter_recurrent-neural-networks/language-model.html', '9.3 Language models'), karp(8), karp(2)],
      'How does byte-pair encoding build a vocabulary? Define perplexity.'),
    L('seq.text.w2v', 'Word embeddings: word2vec & GloVe', 'Distributional hypothesis; skip-gram, negative sampling; GloVe.',
      [sq('viZrOnJclY0', 'Word embedding and word2vec'), jal('illustrated-word2vec', 'The illustrated word2vec'), d2l('chapter_natural-language-processing-pretraining/word2vec.html', '15.1 word2vec'), d2l('chapter_natural-language-processing-pretraining/approx-training.html', '15.2 Negative sampling'), lw('2017-10-15-word-embedding', 'Learning word embedding'), arx('1301.3781', 'word2vec')],
      'Write the skip-gram objective. Why is negative sampling needed?'),
  ]),
  T('seq.rnn', 'Recurrent networks', 'Memory through recurrence.', [
    L('seq.rnn.rnn', 'RNNs & backprop through time', 'Hidden state recurrence; BPTT; vanishing/exploding gradients; gradient clipping.',
      [sq('AsNTP8Kwu80', 'Recurrent neural networks'), d2l('chapter_recurrent-neural-networks/rnn.html', '9.4 RNNs'), d2l('chapter_recurrent-neural-networks/bptt.html', '9.7 Backprop through time'), d2li('chapter_recurrent-neural-networks/rnn-scratch.html', '9.5 RNN from scratch'), expl('rnn', 'Explaining RNNs without neural networks'), c231('rnn', 'RNNs')],
      'Why do gradients vanish or explode in a vanilla RNN? Relate it to eigenvalues of W_hh.'),
    L('seq.rnn.lstm', 'LSTM & GRU', 'Gates, the cell state highway, GRU simplification.',
      [sq('YCzL96nL7j0', 'LSTM'), colah('2015-08-Understanding-LSTMs', 'Understanding LSTM networks'), d2l('chapter_recurrent-modern/lstm.html', '10.1 LSTM'), d2l('chapter_recurrent-modern/gru.html', '10.2 GRU'), sq('RHGiXPuo_pI', 'LSTM with PyTorch + Lightning')],
      'Write the LSTM equations. How does the cell state mitigate vanishing gradients?'),
    L('seq.rnn.seq2seq', 'Encoder–decoder & beam search', 'Seq2seq for translation; teacher forcing; greedy vs beam decoding.',
      [sq('L8HKweZIOmg', 'Encoder-decoder (seq2seq)'), d2l('chapter_recurrent-modern/seq2seq.html', '10.7 Seq2seq'), d2l('chapter_recurrent-modern/beam-search.html', '10.8 Beam search'), arx('1409.3215', 'Sequence to sequence learning')],
      'What is the information bottleneck in vanilla seq2seq? How does beam search differ from greedy decoding?'),
  ]),
  T('seq.att', 'Attention', 'The idea that replaced recurrence.', [
    L('seq.att.basic', 'Attention mechanisms', 'Queries, keys, values; additive (Bahdanau) and dot-product attention.',
      [sq('PSs6nxngL6k', 'Attention'), jal('visualizing-neural-machine-translation-mechanics-of-seq2seq-models-with-attention', 'Seq2seq with attention'), d2l('chapter_attention-mechanisms-and-transformers/queries-keys-values.html', '11.1 Queries, keys, values'), d2l('chapter_attention-mechanisms-and-transformers/attention-scoring-functions.html', '11.3 Attention scoring'), d2l('chapter_attention-mechanisms-and-transformers/bahdanau-attention.html', '11.4 Bahdanau attention'), lw('2018-06-24-attention', 'Attention? Attention!'), arx('1409.0473', 'Bahdanau attention')],
      'Write scaled dot-product attention. Why divide by √d_k?'),
  ]),
], [CS224N]))

# ───────────────────────── 12. Transformers & LLMs
modules.append(M('llm', 'Transformers & large language models', 'The architecture behind modern AI, from equations to a working GPT — and how LLMs are trained, aligned and served.', [
  T('llm.arch', 'The transformer', 'Every component, with the matrix math.', [
    L('llm.arch.selfatt', 'Self-attention & multi-head attention', 'Q/K/V projections, masking, multi-head concatenation, complexity O(n²d).',
      [sq('zxQyTK8quyY', 'Transformers'), sq('KphmOJnLAdI', 'The matrix math behind transformers'), b3('Attention in transformers, step-by-step'), d2l('chapter_attention-mechanisms-and-transformers/multihead-attention.html', '11.5 Multi-head attention'), d2l('chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.html', '11.6 Self-attention'), dml('self-attention'), ex('Implement causal multi-head self-attention in NumPy, then PyTorch; check against nn.MultiheadAttention')],
      'Write multi-head attention with shapes. Why is a causal mask needed for language modelling?', 'Core'),
    L('llm.arch.pos', 'Positional encodings: sinusoidal, learned, RoPE', 'Injecting order into a permutation-invariant model.',
      [d2l('chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.html', '11.6 Positional encoding'), arx('2104.09864', 'RoFormer (rotary embeddings)'), lw('2023-01-27-the-transformer-family-v2', 'The transformer family v2')],
      'Why is self-attention permutation-equivariant? How does RoPE encode relative position?'),
    L('llm.arch.block', 'The full transformer block', 'Residual stream, LayerNorm (pre vs post), feed-forward MLP, encoder vs decoder.',
      [jal('illustrated-transformer', 'The illustrated transformer'), d2l('chapter_attention-mechanisms-and-transformers/transformer.html', '11.7 The transformer'), arx('1706.03762', 'Attention is all you need'), ANNOT, b3('But what is a GPT? Visual intro to transformers')],
      'Sketch a pre-LN decoder block. Roughly what fraction of parameters sit in the MLP vs attention?'),
    L('llm.arch.gpt', 'Build GPT from scratch', 'Code a decoder-only transformer and train it on text.',
      [karp(7), sq('C9QSpl5nmrY', 'Coding a ChatGPT-like transformer from scratch'), R('karpathy/nanoGPT', 'https://github.com/karpathy/nanoGPT', 'implement', 'code'), ex('Train a character-level GPT on a text you like; sample from it at several temperatures')],
      'Walk through one training step of your GPT: shapes from tokens to loss.', 'Pro'),
  ]),
  T('llm.pre', 'Pretraining', 'How foundation models learn from raw text.', [
    L('llm.pre.bert', 'Encoders: BERT & masked language modelling', 'Bidirectional context, MLM and NSP, fine-tuning heads.',
      [sq('GDN649X_acE', 'Encoder-only transformers (BERT)'), jal('illustrated-bert', 'The illustrated BERT'), d2l('chapter_natural-language-processing-pretraining/bert.html', '15.8 BERT'), arx('1810.04805', 'BERT'), HF(3, 'Fine-tuning a pretrained model')],
      'Why can’t BERT generate text left-to-right? What does masking 15% of tokens achieve?'),
    L('llm.pre.gpt', 'Decoders: GPT & next-token prediction', 'Autoregressive pretraining, in-context learning, sampling (temperature, top-k, top-p).',
      [sq('bQ5BoolX9Ag', 'Decoder-only transformers (ChatGPT)'), jal('illustrated-gpt2', 'The illustrated GPT-2'), jal('how-gpt3-works-visualizations-animations', 'How GPT-3 works'), arx('2005.14165', 'Language models are few-shot learners (GPT-3)'), HF(1, 'Transformer models')],
      'How do temperature and top-p change sampling? What is in-context learning?'),
    L('llm.pre.scale', 'Scaling laws & compute-optimal training', 'Loss vs parameters, data and compute; Chinchilla.',
      [arx('2001.08361', 'Scaling laws for neural language models'), arx('2203.15556', 'Training compute-optimal LLMs (Chinchilla)'), lw('2026-06-24-scaling-laws', 'Scaling laws, carefully')],
      'What did Chinchilla conclude about tokens per parameter? Estimate FLOPs ≈ 6·N·D for a 7B model on 1T tokens.'),
  ]),
  T('llm.post', 'Post-training & adaptation', 'Turning a base model into a helpful assistant.', [
    L('llm.post.sft', 'Fine-tuning & parameter-efficient methods (LoRA)', 'Full fine-tuning vs adapters; LoRA’s low-rank update; quantised fine-tuning.',
      [arx('2106.09685', 'LoRA'), HF(3, 'Fine-tuning'), ex('Show that LoRA with rank r on a d×d matrix trains 2dr parameters instead of d²')],
      'Explain LoRA’s ΔW = BA. Why is B initialised to zero?'),
    L('llm.post.rlhf', 'RLHF, reward models & DPO', 'Preference data, reward modelling, PPO with a KL penalty, direct preference optimisation.',
      [sq('qPN_XZcJf_s', 'RLHF clearly explained'), arx('2203.02155', 'Training LMs to follow instructions (InstructGPT)'), arx('2305.18290', 'Direct preference optimization (DPO)'), lw('2024-11-28-reward-hacking', 'Reward hacking in RL')],
      'What are the three stages of RLHF? Why add a KL penalty to the reference model? How does DPO avoid a reward model?'),
    L('llm.post.prompt', 'Prompting, reasoning & agents', 'Few-shot, chain-of-thought, tool use, agents.',
      [lw('2023-03-15-prompt-engineering', 'Prompt engineering'), lw('2025-05-01-thinking', 'Why we think'), lw('2023-06-23-agent', 'LLM-powered autonomous agents')],
      'Why does chain-of-thought improve reasoning? What components make up an LLM agent?'),
  ]),
  T('llm.sys', 'LLM systems', 'Retrieval, efficiency and evaluation.', [
    L('llm.sys.rag', 'Embeddings, vector search & RAG', 'Dense retrieval, chunking, re-ranking, retrieval-augmented generation.',
      [arx('2005.11401', 'Retrieval-augmented generation'), jal('illustrated-retrieval-transformer', 'The illustrated retrieval transformer'), lw('2024-07-07-hallucination', 'Extrinsic hallucinations in LLMs'), HF(5, 'Datasets & semantic search')],
      'Design a RAG pipeline for company docs. How would you evaluate retrieval quality separately from generation?'),
    L('llm.sys.infer', 'Inference optimisation', 'KV cache, quantisation, FlashAttention, speculative decoding, batching.',
      [lw('2023-01-10-inference-optimization', 'Large transformer inference optimisation'), arx('2205.14135', 'FlashAttention'), ex('Compute KV-cache memory for a 7B model (32 layers, d=4096) at 4k context in fp16')],
      'What does the KV cache store and why does it make decoding O(n) per token? What does quantisation trade off?'),
    L('llm.sys.moe', 'Mixture of experts & long context', 'Sparse expert routing; efficient attention variants.',
      [arx('2101.03961', 'Switch transformers (MoE)'), lw('2023-01-27-the-transformer-family-v2', 'Transformer family v2: efficient attention')],
      'How does top-k expert routing keep compute constant as parameters grow? What is load balancing loss for?'),
  ]),
], [ANNOT, R('Hugging Face LLM course', 'https://huggingface.co/learn/llm-course/chapter1/1', 'implement', 'course'), CS224N]))

# ───────────────────────── 13. Generative models
modules.append(M('gen', 'Generative models', 'Learning to create data: autoencoders, VAEs, GANs, flows and diffusion.', [
  T('gen.latent', 'Latent-variable models', 'Compressing and generating through a latent space.', [
    L('gen.latent.ae', 'Autoencoders', 'Undercomplete, denoising and sparse autoencoders; representation learning.',
      [dlb('autoencoders', 'Ch. 14 Autoencoders'), lw('2018-08-12-vae', 'From autoencoder to beta-VAE'), ex('Train a 2-D bottleneck autoencoder on MNIST and plot the latent space')],
      'Why does a plain autoencoder not give a good generative model?'),
    L('gen.latent.vae', 'Variational autoencoders & the ELBO', 'Variational inference, ELBO derivation, reparameterisation trick.',
      [lw('2018-08-12-vae', 'From autoencoder to beta-VAE'), arx('1312.6114', 'Auto-encoding variational Bayes'), dlb('generative_models', 'Ch. 20 Deep generative models'), UDL, ex('Derive the ELBO: log p(x) ≥ E_q[log p(x|z)] − KL(q(z|x)‖p(z))')],
      'Derive the ELBO. Why is the reparameterisation trick needed to backprop through sampling?', 'Pro'),
  ]),
  T('gen.adv', 'GANs & flows', 'Adversarial training and exact-likelihood flows.', [
    L('gen.adv.gan', 'Generative adversarial networks', 'Minimax game, mode collapse, DCGAN, Wasserstein GAN.',
      [d2l('chapter_generative-adversarial-networks/gan.html', '20.1 GANs'), d2li('chapter_generative-adversarial-networks/dcgan.html', '20.2 DCGAN'), lw('2017-08-20-gan', 'From GAN to WGAN'), arx('1406.2661', 'Generative adversarial nets')],
      'Write the GAN objective. What is the optimal discriminator, and what divergence does the generator then minimise?'),
    L('gen.adv.flow', 'Normalising flows', 'Change of variables, invertible layers, exact likelihood.',
      [lw('2018-10-13-flow-models', 'Flow-based deep generative models')],
      'State the change-of-variables formula. Why must flow layers have tractable Jacobian determinants?'),
  ]),
  T('gen.diff', 'Diffusion models', 'The engine of modern image and video generation.', [
    L('gen.diff.ddpm', 'Denoising diffusion (DDPM) & score matching', 'Forward noising, learned reverse process, noise-prediction loss, sampling.',
      [lw('2021-07-11-diffusion-models', 'What are diffusion models?'), jal('illustrated-stable-diffusion', 'The illustrated Stable Diffusion'), arx('2006.11239', 'Denoising diffusion probabilistic models'), cs229('Part V: Diffusion models'), ex('Implement a tiny DDPM on 2-D toy data (e.g. a spiral)')],
      'Write q(x_t | x_0) in closed form. Why does predicting the noise ε give a simple MSE loss?', 'Pro'),
    L('gen.diff.guided', 'Latent diffusion, guidance & multimodal models', 'Stable Diffusion, classifier-free guidance, CLIP.',
      [jal('illustrated-stable-diffusion', 'The illustrated Stable Diffusion'), arx('2103.00020', 'CLIP'), lw('2024-04-12-diffusion-video', 'Diffusion models for video'), lw('2022-06-09-vlm', 'Visual language models')],
      'Why run diffusion in a latent space? How does classifier-free guidance work?'),
  ]),
]))

# ───────────────────────── 14. Reinforcement learning
modules.append(M('rl', 'Reinforcement learning', 'Learning by acting: MDPs, value methods, policy gradients and deep RL.', [
  T('rl.found', 'Foundations', 'The RL problem and dynamic programming.', [
    L('rl.found.mdp', 'MDPs, returns & Bellman equations', 'States, actions, rewards, discounting, value and action-value functions.',
      [sq('Z-T0iJEXiwM', 'Reinforcement learning essential concepts'), mlu('reinforcement-learning', 'Reinforcement learning'), spin('spinningup/rl_intro', 'Key concepts in RL'), d2l('chapter_reinforcement-learning/mdp.html', '17.1 MDPs'), SUTTON, ex('Write the Bellman expectation and optimality equations for V and Q')],
      'Write the Bellman optimality equation for Q*. What does the discount factor γ control?'),
    L('rl.found.dp', 'Value & policy iteration', 'Dynamic programming when the model is known.',
      [d2l('chapter_reinforcement-learning/value-iter.html', '17.2 Value iteration'), cs229('Part VI: MDPs, value and policy iteration'), SUTTON, ex('Solve FrozenLake with value iteration')],
      'Why does value iteration converge (contraction mapping)? How does policy iteration differ?'),
    L('rl.found.bandit', 'Multi-armed bandits & exploration', 'ε-greedy, UCB, Thompson sampling.',
      [lw('2018-01-23-multi-armed-bandit', 'The multi-armed bandit problem'), lw('2020-06-07-exploration-drl', 'Exploration strategies in deep RL')],
      'Compare ε-greedy, UCB and Thompson sampling. What is regret?'),
  ]),
  T('rl.model_free', 'Model-free RL', 'Learning from experience.', [
    L('rl.mf.td', 'Monte Carlo, TD learning & Q-learning', 'Bootstrapping; on- vs off-policy; SARSA vs Q-learning.',
      [d2l('chapter_reinforcement-learning/qlearning.html', '17.3 Q-learning'), lw('2018-02-19-rl-overview', 'A (long) peek into RL'), SUTTON],
      'Write the Q-learning update. Why is Q-learning off-policy and SARSA on-policy?'),
    L('rl.mf.dqn', 'Deep Q-networks', 'Function approximation, replay buffers, target networks.',
      [sq('9hbQieQh7-o', 'RL with neural networks'), sq('DVGmsnxB2UQ', 'RL with neural networks: math details'), arx('1312.5602', 'Playing Atari with deep RL (DQN)'), spin('spinningup/rl_intro2', 'Kinds of RL algorithms')],
      'Why do DQNs need experience replay and a target network?'),
    L('rl.mf.pg', 'Policy gradients, actor-critic & PPO', 'REINFORCE, baselines, advantage, trust regions, PPO clipping.',
      [spin('spinningup/rl_intro3', 'Intro to policy optimization'), lw('2018-04-08-policy-gradient', 'Policy gradient algorithms'), spin('algorithms/ppo', 'PPO', 'implement'), arx('1707.06347', 'Proximal policy optimization'), ex('Derive ∇J = E[∇log π(a|s)·G] (the log-derivative trick)')],
      'Derive the policy-gradient theorem’s log-derivative trick. What problem does PPO’s clipping solve?', 'Pro'),
  ]),
], [SUTTON, R('OpenAI Spinning Up', 'https://spinningup.openai.com/en/latest/', 'deep', 'course')]))

# ───────────────────────── 15. More models
modules.append(M('more', 'More models: recsys, GPs & tuning', 'Recommender systems, Gaussian processes and hyperparameter optimisation.', [
  T('more.rec', 'Recommender systems', 'A top interview domain.', [
    L('more.rec.mf', 'Collaborative filtering & matrix factorisation', 'User–item matrices, implicit feedback, ALS/SGD factorisation.',
      [d2l('chapter_recommender-systems/recsys-intro.html', '21.1 Recommender systems overview'), d2l('chapter_recommender-systems/mf.html', '21.3 Matrix factorization'), d2l('chapter_recommender-systems/ranking.html', '21.5 Personalized ranking')],
      'How does matrix factorisation predict a missing rating? How do you handle cold start?'),
    L('more.rec.deep', 'Deep & feature-rich recommenders', 'Two-tower retrieval, factorisation machines, DeepFM, sequence-aware recs.',
      [d2l('chapter_recommender-systems/fm.html', '21.9 Factorization machines'), d2l('chapter_recommender-systems/deepfm.html', '21.10 DeepFM'), d2l('chapter_recommender-systems/seqrec.html', '21.7 Sequence-aware recommenders')],
      'Describe a two-stage (retrieval + ranking) recommender. Why split it in two?'),
  ]),
  T('more.gp', 'Gaussian processes & tuning', 'Bayesian non-parametrics and smarter search.', [
    L('more.gp.gp', 'Gaussian processes', 'Priors over functions, kernels, posterior mean & variance.',
      [d2l('chapter_gaussian-processes/gp-intro.html', '18.1 Intro to GPs'), d2l('chapter_gaussian-processes/gp-inference.html', '18.3 GP inference'), bishop('Ch. 6.4 Gaussian processes')],
      'What does a GP posterior give you that a neural net doesn’t? Why do GPs scale as O(n³)?'),
    L('more.gp.hpo', 'Hyperparameter optimisation', 'Grid vs random search, successive halving, Bayesian optimisation.',
      [d2l('chapter_hyperparameter-optimization/hyperopt-intro.html', '19.1 What is HPO?'), d2l('chapter_hyperparameter-optimization/sh-intro.html', '19.4 Multi-fidelity HPO'), skl('grid_search', 'Tuning hyper-parameters')],
      'Why is random search usually better than grid search? How does successive halving save compute?'),
  ]),
]))

# ───────────────────────── 16. ML systems
modules.append(M('mlops', 'ML systems & MLOps', 'Taking models to production and training at scale.', [
  T('mlops.scale', 'Training at scale', 'GPUs, parallelism and efficiency.', [
    L('mlops.scale.hw', 'Hardware & computational performance', 'GPUs, memory bandwidth, mixed precision.',
      [d2l('chapter_computational-performance/hardware.html', '13.4 Hardware'), d2l('chapter_computational-performance/async-computation.html', '13.2 Asynchronous computation')],
      'Why is training often memory-bandwidth bound? What does mixed precision save and risk?'),
    L('mlops.scale.dist', 'Distributed training', 'Data, tensor and pipeline parallelism; ZeRO/FSDP; parameter servers.',
      [lw('2021-09-25-train-large', 'How to train really large models on many GPUs'), d2l('chapter_computational-performance/multiple-gpus.html', '13.5 Multi-GPU training'), d2l('chapter_computational-performance/parameterserver.html', '13.7 Parameter servers'), PT('intermediate/ddp_tutorial', 'Distributed data parallel')],
      'Compare data, tensor and pipeline parallelism. What does ZeRO shard?'),
  ]),
  T('mlops.prod', 'Production ML', 'Designing, deploying and monitoring ML systems.', [
    L('mlops.prod.design', 'ML system design', 'Framing, data pipelines, features, offline/online evaluation, serving.',
      [R('Made With ML (Goku Mohandas)', 'https://madewithml.com/', 'apply', 'course'), MLIB, yt('ML system design interview example', 'Videos: ML system design interviews', 'practice')],
      'Design a spam filter end to end: data, features, model, metrics, serving, monitoring.'),
    L('mlops.prod.shift', 'Distribution shift & monitoring', 'Covariate, label and concept shift; drift detection; retraining.',
      [d2l('chapter_linear-classification/environment-and-distribution-shift.html', '4.7 Environment and distribution shift'), ex('Simulate covariate shift on a dataset and measure the accuracy drop')],
      'Distinguish covariate shift, label shift and concept drift. How would you detect each in production?'),
  ]),
]))

# ───────────────────────── 17. Interview prep
modules.append(M('interview', 'Interview prep', 'Turn deep understanding into confident interview answers.', [
  T('interview.prep', 'Practice', 'Questions, coding and design.', [
    L('interview.prep.theory', 'ML theory questions', '200+ knowledge questions across math, ML and DL.',
      [MLIB, R('Chip Huyen MLIB: Part II questions', 'https://huyenchip.com/ml-interviews-book/contents/part-ii.-questions.html', 'practice', 'book')],
      'Pick five random questions from MLIB and answer them aloud in under two minutes each.'),
    L('interview.prep.code', 'ML coding from scratch', 'Implement linear/logistic regression, k-means, kNN, attention, backprop under time pressure.',
      [R('Deep-ML problem set', 'https://www.deep-ml.com/problems', 'practice', 'problem'), ex('In 30 minutes: implement logistic regression with L2 and mini-batch SGD in NumPy')],
      'Which five algorithms can you implement from scratch without notes right now?'),
    L('interview.prep.design', 'ML system design interviews', 'Recommendation, search ranking, ads CTR, fraud, feed ranking.',
      [MLIB, R('Made With ML', 'https://madewithml.com/', 'apply', 'course'), yt('ML system design mock interview', 'Videos: ML system design mock interviews', 'practice')],
      'Walk through designing a news-feed ranking model: objective, labels, features, model, metrics, A/B test.'),
  ]),
]))

subject = {
    'id': 'ml', 'title': 'ML & DL', 'long': 'Machine Learning & Deep Learning — math-first, code-always',
    'color': '#a78bfa', 'icon': 'i:Brain', 'version': 1,
    'description': 'Linear algebra → calculus & optimisation → probability → statistics → ML fundamentals → classical ML → deep learning → vision → sequences → transformers & LLMs → generative models → RL → ML systems → interviews. Every lesson: intuition, the math, code, and an exercise.',
    'levels': ['Module', 'Topic', 'Lesson'],
    'credits': 'Links to StatQuest, 3Blue1Brown, d2l.ai, the Deep Learning book, MML book, CS229, CS231n, Karpathy, MLU-Explain, Lilian Weng, Jay Alammar, colah, explained.ai, Spinning Up, arXiv.',
    'children': modules,
}
out = os.path.join(HERE, '..', 'src', 'study-data', 'ml.json')
json.dump(subject, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
ids = []
def walk(n):
    ids.append(n['id'])
    for c in n.get('children', []): walk(c)
walk(subject)
assert len(ids) == len(set(ids)), 'duplicate ids'
lessons = sum(len(t['children']) for m in modules for t in m['children'])
print('ml modules', len(modules), 'topics', sum(len(m['children']) for m in modules), 'lessons', lessons,
      'resources', sum(len(l['resources']) for m in modules for t in m['children'] for l in t['children']), 'bytes', os.path.getsize(out))

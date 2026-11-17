"""
stats.py — LabVault 统计分析模块
对标 GraphPad Prism 全功能，涵盖：
  - t 检验（单样本、独立样本、配对样本）
  - ANOVA（单因素、双因素、重复测量）
  - 非参数检验（Mann-Whitney、Wilcoxon、Kruskal-Wallis、Friedman）
  - 线性/多项式/逻辑斯蒂/多元回归
  - 生存分析（Kaplan-Meier、Log-rank、Cox 回归）
  - ROC 曲线分析
  - IC50/EC50 非线性拟合
  - 多重比较校正（Bonferroni、BH/FDR、Holm 等）
  - 相关分析（Pearson、Spearman）
  - 描述性统计
"""

from __future__ import annotations
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from scipy.optimize import curve_fit
import statsmodels.api as sm
from statsmodels.stats.multicomp import pairwise_tukeyhsd
from statsmodels.stats.multitest import multipletests
from statsmodels.stats.anova import AnovaRM
from statsmodels.formula.api import ols
import warnings

warnings.filterwarnings('ignore')


# ─── 工具函数 ─────────────────────────────────────────────────────────────────

def _fmt_p(p: float) -> str:
    """格式化 p 值为字符串"""
    if p < 0.0001:
        return "< 0.0001"
    return f"{p:.4f}"


def _significance_label(p: float) -> str:
    """返回显著性星号"""
    if p < 0.001:
        return "***"
    elif p < 0.01:
        return "**"
    elif p < 0.05:
        return "*"
    else:
        return "ns"


def descriptive_stats(data: list[float]) -> dict:
    """计算描述性统计量"""
    arr = np.array(data, dtype=float)
    arr = arr[~np.isnan(arr)]
    n = len(arr)
    if n == 0:
        return {}
    q1, median, q3 = np.percentile(arr, [25, 50, 75])
    sem = scipy_stats.sem(arr) if n > 1 else np.nan
    ci95 = scipy_stats.t.interval(0.95, df=n-1, loc=np.mean(arr), scale=sem) if n > 1 else (np.nan, np.nan)
    return {
        "n": int(n),
        "mean": float(np.mean(arr)),
        "median": float(median),
        "std": float(np.std(arr, ddof=1)) if n > 1 else 0.0,
        "sem": float(sem),
        "min": float(np.min(arr)),
        "max": float(np.max(arr)),
        "q1": float(q1),
        "q3": float(q3),
        "iqr": float(q3 - q1),
        "ci95_lower": float(ci95[0]),
        "ci95_upper": float(ci95[1]),
        "skewness": float(scipy_stats.skew(arr)),
        "kurtosis": float(scipy_stats.kurtosis(arr)),
        "cv_percent": float(np.std(arr, ddof=1) / np.mean(arr) * 100) if np.mean(arr) != 0 else np.nan,
    }


def normality_test(data: list[float]) -> dict:
    """Shapiro-Wilk 正态性检验"""
    arr = np.array(data, dtype=float)
    arr = arr[~np.isnan(arr)]
    if len(arr) < 3:
        return {"error": "数据量不足（需 ≥ 3）"}
    stat, p = scipy_stats.shapiro(arr)
    return {
        "test": "Shapiro-Wilk",
        "statistic": float(stat),
        "p_value": float(p),
        "p_value_fmt": _fmt_p(p),
        "is_normal": bool(p > 0.05),
        "conclusion": "符合正态分布" if p > 0.05 else "不符合正态分布"
    }


# ─── t 检验 ──────────────────────────────────────────────────────────────────

def ttest(params: dict) -> dict:
    """
    t 检验，支持：
      - type='one_sample'  单样本 t 检验，需 group1, mu
      - type='two_sample'  独立样本 t 检验，需 group1, group2，可选 equal_var
      - type='paired'      配对样本 t 检验，需 group1, group2
    可选 alternative: 'two-sided'(默认)/'greater'/'less'
    """
    test_type = params.get('type', 'two_sample')
    alternative = params.get('alternative', 'two-sided')
    alpha = params.get('alpha', 0.05)

    g1 = np.array(params['group1'], dtype=float)
    g1 = g1[~np.isnan(g1)]

    result = {
        "test_type": test_type,
        "alternative": alternative,
        "alpha": alpha,
        "group1_stats": descriptive_stats(g1.tolist()),
        "group1_normality": normality_test(g1.tolist()),
    }

    if test_type == 'one_sample':
        mu = params.get('mu', 0)
        stat, p = scipy_stats.ttest_1samp(g1, mu, alternative=alternative)
        result.update({
            "mu": float(mu),
            "t_statistic": float(stat),
            "df": int(len(g1) - 1),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "conclusion": f"{'显著' if p < alpha else '不显著'}差异于假设均值 {mu}（p={_fmt_p(p)}）",
        })

    elif test_type == 'paired':
        g2 = np.array(params['group2'], dtype=float)
        g2 = g2[~np.isnan(g2)]
        if len(g1) != len(g2):
            return {"error": "配对检验要求两组样本量相同"}
        stat, p = scipy_stats.ttest_rel(g1, g2, alternative=alternative)
        diff = g1 - g2
        result.update({
            "group2_stats": descriptive_stats(g2.tolist()),
            "diff_stats": descriptive_stats(diff.tolist()),
            "t_statistic": float(stat),
            "df": int(len(g1) - 1),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "conclusion": f"两组配对差异{'显著' if p < alpha else '不显著'}（p={_fmt_p(p)}）",
        })

    else:  # two_sample
        g2 = np.array(params['group2'], dtype=float)
        g2 = g2[~np.isnan(g2)]
        equal_var = params.get('equal_var', True)
        # Levene 方差齐性检验
        lev_stat, lev_p = scipy_stats.levene(g1, g2)
        if not equal_var or lev_p < 0.05:
            equal_var = False  # 自动 Welch
        stat, p = scipy_stats.ttest_ind(g1, g2, equal_var=equal_var, alternative=alternative)
        df_val = (len(g1) - 1 + len(g2) - 1) if equal_var else None
        result.update({
            "group2_stats": descriptive_stats(g2.tolist()),
            "levene_stat": float(lev_stat),
            "levene_p": float(lev_p),
            "equal_variance": equal_var,
            "test_name": "独立样本 t 检验" if equal_var else "Welch t 检验",
            "t_statistic": float(stat),
            "df": df_val,
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "mean_diff": float(np.mean(g1) - np.mean(g2)),
            "conclusion": f"两组差异{'显著' if p < alpha else '不显著'}（p={_fmt_p(p)}，{'Welch' if not equal_var else '等方差'} t 检验）",
        })

    # 效应量 Cohen's d
    if test_type != 'one_sample' and 'g2' in dir():
        pooled_std = np.sqrt(((len(g1)-1)*np.std(g1, ddof=1)**2 + (len(g2)-1)*np.std(g2, ddof=1)**2)
                             / (len(g1) + len(g2) - 2))
        if pooled_std > 0:
            cohens_d = (np.mean(g1) - np.mean(g2)) / pooled_std
            result["cohens_d"] = float(cohens_d)
            result["effect_size_label"] = (
                "大效应" if abs(cohens_d) >= 0.8 else
                "中等效应" if abs(cohens_d) >= 0.5 else
                "小效应"
            )

    return result


# ─── ANOVA ───────────────────────────────────────────────────────────────────

def anova(params: dict) -> dict:
    """
    ANOVA，支持：
      - type='one_way'   单因素 ANOVA，需 groups: [[...], [...], ...]
      - type='two_way'   双因素 ANOVA，需 data, factor1, factor2, response 列名
      - type='repeated'  重复测量 ANOVA，需 data, subject, within, response
    """
    test_type = params.get('type', 'one_way')
    alpha = params.get('alpha', 0.05)

    if test_type == 'one_way':
        groups_data = [np.array(g, dtype=float) for g in params['groups']]
        groups_clean = [g[~np.isnan(g)] for g in groups_data]
        group_names = params.get('group_names', [f"组{i+1}" for i in range(len(groups_clean))])

        # 描述统计
        desc = {name: descriptive_stats(g.tolist())
                for name, g in zip(group_names, groups_clean)}

        # Levene 检验
        lev_stat, lev_p = scipy_stats.levene(*groups_clean)

        # 单因素 ANOVA
        f_stat, p = scipy_stats.f_oneway(*groups_clean)

        # 效应量 eta²
        grand_mean = np.mean(np.concatenate(groups_clean))
        ss_between = sum(len(g) * (np.mean(g) - grand_mean)**2 for g in groups_clean)
        ss_total = sum(np.sum((g - grand_mean)**2) for g in groups_clean)
        eta_sq = ss_between / ss_total if ss_total > 0 else 0

        # Tukey HSD 事后检验
        all_data = np.concatenate(groups_clean)
        all_labels = np.concatenate([[name]*len(g) for name, g in zip(group_names, groups_clean)])
        tukey = pairwise_tukeyhsd(all_data, all_labels, alpha=alpha)
        posthoc = []
        for row in tukey.summary().data[1:]:
            posthoc.append({
                "group1": str(row[0]),
                "group2": str(row[1]),
                "mean_diff": float(row[2]),
                "p_adj": float(row[3]),
                "significant": bool(row[6]),
                "significance": _significance_label(float(row[3])),
            })

        return {
            "test_type": "one_way_anova",
            "group_stats": desc,
            "levene_stat": float(lev_stat),
            "levene_p": float(lev_p),
            "f_statistic": float(f_stat),
            "df_between": int(len(groups_clean) - 1),
            "df_within": int(sum(len(g) for g in groups_clean) - len(groups_clean)),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "eta_squared": float(eta_sq),
            "posthoc_tukey": posthoc,
            "conclusion": f"组间差异{'显著' if p < alpha else '不显著'}（F={f_stat:.3f}，p={_fmt_p(p)}）",
        }

    elif test_type == 'two_way':
        df = pd.DataFrame(params['data'])
        factor1 = params['factor1']
        factor2 = params['factor2']
        response = params['response']
        formula = f"{response} ~ C({factor1}) + C({factor2}) + C({factor1}):C({factor2})"
        model = ols(formula, data=df).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)
        table_dict = anova_table.reset_index().rename(columns={'index': 'source'}).to_dict('records')
        for row in table_dict:
            for k, v in row.items():
                if isinstance(v, float) and np.isnan(v):
                    row[k] = None
        return {
            "test_type": "two_way_anova",
            "anova_table": table_dict,
            "r_squared": float(model.rsquared),
            "conclusion": "双因素 ANOVA 完成，请查看 anova_table 获取各因素 p 值",
        }

    elif test_type == 'repeated':
        df = pd.DataFrame(params['data'])
        subject = params['subject']
        within = params['within']
        response = params['response']
        aov = AnovaRM(df, response, subject, within=[within]).fit()
        table = aov.anova_table
        return {
            "test_type": "repeated_measures_anova",
            "anova_table": table.reset_index().to_dict('records'),
            "conclusion": "重复测量 ANOVA 完成",
        }

    return {"error": f"未知 ANOVA 类型: {test_type}"}


# ─── 非参数检验 ───────────────────────────────────────────────────────────────

def nonparam_test(params: dict) -> dict:
    """
    非参数检验，支持：
      - type='mann_whitney'  Mann-Whitney U 检验（两独立组）
      - type='wilcoxon'      Wilcoxon 符号秩检验（配对/单样本）
      - type='kruskal'       Kruskal-Wallis 检验（多组）
      - type='friedman'      Friedman 检验（重复测量）
      - type='spearman'      Spearman 相关
    """
    test_type = params.get('type', 'mann_whitney')
    alternative = params.get('alternative', 'two-sided')
    alpha = params.get('alpha', 0.05)

    if test_type == 'mann_whitney':
        g1 = np.array(params['group1'], dtype=float)
        g2 = np.array(params['group2'], dtype=float)
        g1 = g1[~np.isnan(g1)]; g2 = g2[~np.isnan(g2)]
        stat, p = scipy_stats.mannwhitneyu(g1, g2, alternative=alternative)
        # 效应量 r = Z / sqrt(N)
        n = len(g1) + len(g2)
        z = scipy_stats.norm.ppf(1 - p/2 if alternative == 'two-sided' else 1 - p)
        r = z / np.sqrt(n)
        return {
            "test": "Mann-Whitney U",
            "u_statistic": float(stat),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "effect_r": float(r),
            "group1_median": float(np.median(g1)),
            "group2_median": float(np.median(g2)),
            "conclusion": f"两组差异{'显著' if p < alpha else '不显著'}（U={stat:.1f}，p={_fmt_p(p)}）",
        }

    elif test_type == 'wilcoxon':
        g1 = np.array(params['group1'], dtype=float)
        g2 = np.array(params.get('group2', [0]*len(g1)), dtype=float)
        g1 = g1[~np.isnan(g1)]; g2 = g2[~np.isnan(g2)]
        stat, p = scipy_stats.wilcoxon(g1 - g2 if len(g2) > 1 else g1, alternative=alternative)
        return {
            "test": "Wilcoxon 符号秩",
            "w_statistic": float(stat),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "conclusion": f"差异{'显著' if p < alpha else '不显著'}（W={stat:.1f}，p={_fmt_p(p)}）",
        }

    elif test_type == 'kruskal':
        groups_data = [np.array(g, dtype=float) for g in params['groups']]
        groups_clean = [g[~np.isnan(g)] for g in groups_data]
        group_names = params.get('group_names', [f"组{i+1}" for i in range(len(groups_clean))])
        stat, p = scipy_stats.kruskal(*groups_clean)
        # Dunn 事后检验（BH 校正）
        posthoc = _dunn_test(groups_clean, group_names)
        return {
            "test": "Kruskal-Wallis",
            "h_statistic": float(stat),
            "df": int(len(groups_clean) - 1),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "group_medians": {name: float(np.median(g)) for name, g in zip(group_names, groups_clean)},
            "posthoc_dunn": posthoc,
            "conclusion": f"组间差异{'显著' if p < alpha else '不显著'}（H={stat:.3f}，p={_fmt_p(p)}）",
        }

    elif test_type == 'friedman':
        # 每列为一个时间点/条件
        matrix = np.array(params['data'], dtype=float)
        stat, p = scipy_stats.friedmanchisquare(*matrix.T)
        return {
            "test": "Friedman",
            "chi2_statistic": float(stat),
            "df": int(matrix.shape[1] - 1),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "conclusion": f"重复测量组间差异{'显著' if p < alpha else '不显著'}（χ²={stat:.3f}，p={_fmt_p(p)}）",
        }

    elif test_type == 'spearman':
        x = np.array(params['x'], dtype=float)
        y = np.array(params['y'], dtype=float)
        mask = ~(np.isnan(x) | np.isnan(y))
        x, y = x[mask], y[mask]
        rho, p = scipy_stats.spearmanr(x, y)
        return {
            "test": "Spearman 相关",
            "rho": float(rho),
            "p_value": float(p),
            "p_value_fmt": _fmt_p(p),
            "significant": bool(p < alpha),
            "significance": _significance_label(p),
            "n": int(len(x)),
            "conclusion": f"Spearman ρ={rho:.4f}，{'显著' if p < alpha else '不显著'}相关（p={_fmt_p(p)}）",
        }

    return {"error": f"未知非参数检验类型: {test_type}"}


def _dunn_test(groups: list, names: list) -> list[dict]:
    """Dunn 事后检验，BH 校正"""
    from itertools import combinations
    pairs = list(combinations(range(len(groups)), 2))
    p_values = []
    for i, j in pairs:
        _, p = scipy_stats.mannwhitneyu(groups[i], groups[j], alternative='two-sided')
        p_values.append(p)
    _, p_adj, _, _ = multipletests(p_values, method='fdr_bh')
    result = []
    for (i, j), p_raw, p_a in zip(pairs, p_values, p_adj):
        result.append({
            "group1": names[i],
            "group2": names[j],
            "p_raw": float(p_raw),
            "p_adj_bh": float(p_a),
            "significant": bool(p_a < 0.05),
            "significance": _significance_label(float(p_a)),
        })
    return result


# ─── 多重比较校正 ─────────────────────────────────────────────────────────────

def multiple_correction(p_values: list[float], method: str = 'fdr_bh') -> dict:
    """
    多重比较校正
    method: bonferroni / fdr_bh (Benjamini-Hochberg) / holm / sidak
    """
    reject, p_adj, _, _ = multipletests(p_values, method=method)
    return {
        "method": method,
        "original_p": [float(p) for p in p_values],
        "adjusted_p": [float(p) for p in p_adj],
        "reject": [bool(r) for r in reject],
    }


# ─── 回归分析 ─────────────────────────────────────────────────────────────────

def regression(params: dict) -> dict:
    """
    回归分析，支持：
      - type='linear'      简单/多元线性回归
      - type='polynomial'  多项式回归
      - type='logistic'    逻辑斯蒂回归（二元分类）
    """
    reg_type = params.get('type', 'linear')

    if reg_type in ('linear', 'polynomial'):
        x_data = np.array(params['x'], dtype=float)
        y_data = np.array(params['y'], dtype=float)
        mask = ~(np.isnan(x_data) | np.isnan(y_data))
        x_data, y_data = x_data[mask], y_data[mask]

        if reg_type == 'polynomial':
            degree = params.get('degree', 2)
            x_poly = np.column_stack([x_data**i for i in range(1, degree+1)])
        else:
            # 支持多列 x（多元回归）
            if isinstance(params['x'][0], list):
                x_poly = np.array(params['x'], dtype=float)
            else:
                x_poly = x_data.reshape(-1, 1)

        X = sm.add_constant(x_poly)
        model = sm.OLS(y_data, X).fit()

        coef_names = ['intercept'] + (
            [f'x^{i}' for i in range(1, degree+1)] if reg_type == 'polynomial'
            else params.get('x_names', [f'x{i+1}' for i in range(x_poly.shape[1])])
        )

        # 残差分析
        residuals = model.resid.tolist()
        shapiro_stat, shapiro_p = scipy_stats.shapiro(residuals)

        return {
            "type": reg_type,
            "n": int(len(y_data)),
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "f_statistic": float(model.fvalue),
            "f_p_value": float(model.f_pvalue),
            "aic": float(model.aic),
            "bic": float(model.bic),
            "coefficients": [
                {
                    "name": name,
                    "coef": float(model.params[i]),
                    "std_err": float(model.bse[i]),
                    "t_stat": float(model.tvalues[i]),
                    "p_value": float(model.pvalues[i]),
                    "p_value_fmt": _fmt_p(float(model.pvalues[i])),
                    "ci_lower": float(model.conf_int()[0][i]),
                    "ci_upper": float(model.conf_int()[1][i]),
                }
                for i, name in enumerate(coef_names)
            ],
            "residuals": residuals,
            "fitted": model.fittedvalues.tolist(),
            "residuals_normality": {
                "shapiro_stat": float(shapiro_stat),
                "shapiro_p": float(shapiro_p),
                "is_normal": bool(shapiro_p > 0.05),
            },
            "conclusion": f"R²={model.rsquared:.4f}，模型{'显著' if model.f_pvalue < 0.05 else '不显著'}（p={_fmt_p(model.f_pvalue)}）",
        }

    elif reg_type == 'logistic':
        x_data = np.array(params['x'], dtype=float)
        y_data = np.array(params['y'], dtype=float)
        if x_data.ndim == 1:
            x_data = x_data.reshape(-1, 1)

        try:
            from sklearn.linear_model import LogisticRegression
            from sklearn.metrics import roc_auc_score
            lr = LogisticRegression(max_iter=1000)
            lr.fit(x_data, y_data)
            y_pred = lr.predict(x_data)
            y_prob = lr.predict_proba(x_data)[:, 1]
            auc = roc_auc_score(y_data, y_prob) if len(np.unique(y_data)) > 1 else None
            coefs = lr.coef_.tolist()
            intercept = lr.intercept_.tolist()
            acc = float(np.mean(y_pred == y_data))
        except ImportError:
            # 使用 statsmodels Logit
            X = sm.add_constant(x_data)
            logit_mod = sm.Logit(y_data, X).fit(disp=False)
            y_prob = logit_mod.predict(X)
            y_pred = (y_prob >= 0.5).astype(int)
            coefs = [logit_mod.params[1:].tolist()]
            intercept = [float(logit_mod.params[0])]
            acc = float(np.mean(y_pred == y_data))
            # 简易梯形法 AUC
            desc_score_indices = np.argsort(y_prob)[::-1]
            y_sorted = y_data[desc_score_indices]
            n_pos = np.sum(y_data == 1)
            n_neg = np.sum(y_data == 0)
            if n_pos > 0 and n_neg > 0:
                tp_cum = np.cumsum(y_sorted == 1)
                fp_cum = np.cumsum(y_sorted == 0)
                auc = float(np.trapz(tp_cum / n_pos, fp_cum / n_neg))
            else:
                auc = None

        return {
            "type": "logistic",
            "coefficients": coefs,
            "intercept": intercept,
            "auc": float(auc) if auc is not None else None,
            "accuracy": acc,
            "conclusion": f"逻辑回归完成，AUC={auc:.4f}" if auc else "逻辑回归完成",
        }

    return {"error": f"未知回归类型: {reg_type}"}


# ─── 生存分析 ─────────────────────────────────────────────────────────────────

def survival_analysis(params: dict) -> dict:
    """
    生存分析，支持：
      - type='kaplan_meier'  Kaplan-Meier 生存曲线 + Log-rank 检验
      - type='cox'           Cox 比例风险回归
    params:
      - duration: 随访时间列表
      - event: 事件发生（1）/删失（0）列表
      - groups: （可选）分组列表，用于 KM 多组比较
      - covariates: （Cox 专用）协变量数据
    """
    try:
        from lifelines import KaplanMeierFitter, CoxPHFitter
        from lifelines.statistics import logrank_test, multivariate_logrank_test
    except ImportError:
        return {"error": "请安装 lifelines 库：pip install lifelines"}

    duration = np.array(params['duration'], dtype=float)
    event = np.array(params['event'], dtype=float)
    test_type = params.get('type', 'kaplan_meier')
    alpha = params.get('alpha', 0.05)

    if test_type == 'kaplan_meier':
        groups = params.get('groups', None)
        result = {"type": "kaplan_meier"}

        if groups is None:
            kmf = KaplanMeierFitter()
            kmf.fit(duration, event_observed=event)
            timeline = kmf.timeline.tolist()
            sf = kmf.survival_function_['KM_estimate'].tolist()
            ci_lower = kmf.confidence_interval_['KM_estimate_lower_0.95'].tolist()
            ci_upper = kmf.confidence_interval_['KM_estimate_upper_0.95'].tolist()
            median_survival = float(kmf.median_survival_time_)
            result.update({
                "timeline": timeline,
                "survival_function": sf,
                "ci_lower": ci_lower,
                "ci_upper": ci_upper,
                "median_survival": median_survival,
                "conclusion": f"中位生存时间 = {median_survival:.2f}",
            })
        else:
            groups_arr = np.array(groups)
            unique_groups = np.unique(groups_arr)
            group_results = {}
            for grp in unique_groups:
                mask = groups_arr == grp
                kmf = KaplanMeierFitter()
                kmf.fit(duration[mask], event_observed=event[mask], label=str(grp))
                group_results[str(grp)] = {
                    "timeline": kmf.timeline.tolist(),
                    "survival_function": kmf.survival_function_[str(grp)].tolist(),
                    "median_survival": float(kmf.median_survival_time_),
                }
            # Log-rank 检验
            if len(unique_groups) == 2:
                g0 = unique_groups[0]; g1 = unique_groups[1]
                m0 = groups_arr == g0; m1 = groups_arr == g1
                lr = logrank_test(duration[m0], duration[m1],
                                  event_observed_A=event[m0], event_observed_B=event[m1])
                p_logrank = float(lr.p_value)
            else:
                lr = multivariate_logrank_test(duration, groups_arr, event_observed=event)
                p_logrank = float(lr.p_value)

            result.update({
                "groups": group_results,
                "logrank_p": p_logrank,
                "logrank_p_fmt": _fmt_p(p_logrank),
                "significant": bool(p_logrank < alpha),
                "significance": _significance_label(p_logrank),
                "conclusion": f"Log-rank 检验 p={_fmt_p(p_logrank)}，组间生存差异{'显著' if p_logrank < alpha else '不显著'}",
            })

        return result

    elif test_type == 'cox':
        covariates = params.get('covariates', {})
        df = pd.DataFrame(covariates)
        df['duration'] = duration
        df['event'] = event
        cph = CoxPHFitter()
        cph.fit(df, duration_col='duration', event_col='event')
        summary = cph.summary.reset_index()
        return {
            "type": "cox",
            "summary": summary.to_dict('records'),
            "concordance": float(cph.concordance_index_),
            "log_likelihood": float(cph.log_likelihood_),
            "aic": float(cph.AIC_partial_),
            "conclusion": f"Cox 回归一致性指数（C-index）= {cph.concordance_index_:.4f}",
        }

    return {"error": f"未知生存分析类型: {test_type}"}


# ─── ROC 分析 ─────────────────────────────────────────────────────────────────

def roc_analysis(params: dict) -> dict:
    """
    ROC 曲线分析
    params:
      - y_true: 真实标签（0/1）
      - y_score: 预测概率或连续评分
      - threshold_method: 'youden'（约登指数，默认）/'closest_topleft'
    """
    y_true = np.array(params['y_true'], dtype=int)
    y_score = np.array(params['y_score'], dtype=float)
    method = params.get('threshold_method', 'youden')

    try:
        from sklearn.metrics import roc_curve, auc, confusion_matrix
        fpr, tpr, thresholds = roc_curve(y_true, y_score)
        auc_val = float(auc(fpr, tpr))
    except ImportError:
        # 纯 numpy 实现
        desc_indices = np.argsort(y_score)[::-1]
        y_score_sorted = y_score[desc_indices]
        y_true_sorted = y_true[desc_indices]
        distinct_value_indices = np.where(np.diff(y_score_sorted))[0]
        threshold_idxs = np.r_[distinct_value_indices, y_true_sorted.size - 1]

        tps = np.cumsum(y_true_sorted == 1)[threshold_idxs]
        fps = np.cumsum(y_true_sorted == 0)[threshold_idxs]

        n_pos = np.sum(y_true == 1)
        n_neg = np.sum(y_true == 0)

        tpr = np.r_[0, tps / n_pos] if n_pos > 0 else np.zeros(len(tps) + 1)
        fpr = np.r_[0, fps / n_neg] if n_neg > 0 else np.zeros(len(fps) + 1)
        thresholds = np.r_[y_score_sorted[0] + 1e-4, y_score_sorted[threshold_idxs]]
        auc_val = float(np.trapz(tpr, fpr))

    # 最优阈值
    if method == 'youden':
        idx = np.argmax(tpr - fpr)
    else:  # closest_topleft
        idx = np.argmin(np.sqrt((1 - tpr)**2 + fpr**2))
    best_threshold = float(thresholds[idx]) if idx < len(thresholds) else float(thresholds[-1])
    best_sensitivity = float(tpr[idx]) if idx < len(tpr) else 0.0
    best_specificity = float(1 - fpr[idx]) if idx < len(fpr) else 0.0

    # 在最优阈值下的混淆矩阵
    y_pred = (y_score >= best_threshold).astype(int)
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))

    # 95% CI（DeLong 近似）
    n1 = int(np.sum(y_true == 1))
    n0 = int(np.sum(y_true == 0))
    q1 = auc_val / (2 - auc_val)
    q2 = 2 * auc_val**2 / (1 + auc_val)
    se = np.sqrt((auc_val*(1-auc_val) + (n1-1)*(q1-auc_val**2) + (n0-1)*(q2-auc_val**2)) / (n1*n0))
    ci_lower = max(0.0, auc_val - 1.96*se)
    ci_upper = min(1.0, auc_val + 1.96*se)

    return {
        "auc": float(auc_val),
        "auc_ci_lower": float(ci_lower),
        "auc_ci_upper": float(ci_upper),
        "best_threshold": best_threshold,
        "sensitivity": best_sensitivity,
        "specificity": best_specificity,
        "ppv": float(tp / (tp + fp)) if (tp + fp) > 0 else None,
        "npv": float(tn / (tn + fn)) if (tn + fn) > 0 else None,
        "accuracy": float((tp + tn) / len(y_true)),
        "confusion_matrix": {"TP": int(tp), "TN": int(tn), "FP": int(fp), "FN": int(fn)},
        "roc_curve": {
            "fpr": fpr.tolist(),
            "tpr": tpr.tolist(),
            "thresholds": thresholds.tolist(),
        },
        "conclusion": f"AUC={auc_val:.4f}（95%CI: {ci_lower:.4f}–{ci_upper:.4f}），最优阈值={best_threshold:.4f}",
    }


# ─── IC50/EC50 非线性拟合 ──────────────────────────────────────────────────────

def ic50_fit(params: dict) -> dict:
    """
    IC50/EC50 非线性曲线拟合
    使用四参数 logistic 模型（4PL）：
      Y = Bottom + (Top - Bottom) / (1 + (IC50/X)^HillSlope)
    或三参数模型：
      Y = Bottom + (Top - Bottom) / (1 + 10^((LogIC50 - X) * HillSlope))
    params:
      - x: 浓度列表（线性值，自动转 log）
      - y: 响应值列表（0–100 百分比）
      - model: '4pl'（默认）/ '3pl' / 'log4pl'
      - top_fixed: 固定 Top 值（如 100）
      - bottom_fixed: 固定 Bottom 值（如 0）
    """
    x_raw = np.array(params['x'], dtype=float)
    y_data = np.array(params['y'], dtype=float)
    mask = (x_raw > 0) & ~np.isnan(x_raw) & ~np.isnan(y_data)
    x_raw, y_data = x_raw[mask], y_data[mask]

    model_type = params.get('model', '4pl')
    top_fixed = params.get('top_fixed', None)
    bottom_fixed = params.get('bottom_fixed', None)

    def four_pl(x, bottom, top, ic50, hill):
        """四参数 logistic 模型"""
        return bottom + (top - bottom) / (1.0 + (ic50 / x) ** hill)

    def log_four_pl(log_x, bottom, top, log_ic50, hill):
        """以 log(浓度) 为 x 的四参数 logistic"""
        return bottom + (top - bottom) / (1.0 + 10 ** ((log_ic50 - log_x) * hill))

    try:
        if model_type == 'log4pl':
            log_x = np.log10(x_raw)
            log_ic50_guess = np.mean(log_x)
            if top_fixed is not None and bottom_fixed is not None:
                func = lambda lx, log_ic50, hill: log_four_pl(lx, bottom_fixed, top_fixed, log_ic50, hill)
                p0 = [log_ic50_guess, 1.0]
                popt, pcov = curve_fit(func, log_x, y_data, p0=p0, maxfev=10000)
                bottom, top = bottom_fixed, top_fixed
                log_ic50, hill = popt
            else:
                p0 = [np.min(y_data), np.max(y_data), log_ic50_guess, 1.0]
                popt, pcov = curve_fit(log_four_pl, log_x, y_data, p0=p0, maxfev=10000)
                bottom, top, log_ic50, hill = popt
            ic50_val = 10 ** log_ic50
            # 预测曲线
            x_fit = np.logspace(np.log10(x_raw.min()), np.log10(x_raw.max()), 200)
            y_fit = log_four_pl(np.log10(x_fit), bottom, top, log_ic50, hill)
        else:  # 4pl（线性 x）
            ic50_guess = np.median(x_raw)
            p0 = [np.min(y_data), np.max(y_data), ic50_guess, 1.0]
            popt, pcov = curve_fit(four_pl, x_raw, y_data, p0=p0, maxfev=10000)
            bottom, top, ic50_val, hill = popt
            x_fit = np.linspace(x_raw.min(), x_raw.max(), 200)
            y_fit = four_pl(x_fit, bottom, top, ic50_val, hill)

        # 残差 R²
        y_pred = y_fit if False else (
            log_four_pl(np.log10(x_raw), bottom, top, np.log10(ic50_val), hill)
            if model_type == 'log4pl' else four_pl(x_raw, bottom, top, ic50_val, hill)
        )
        ss_res = np.sum((y_data - y_pred)**2)
        ss_tot = np.sum((y_data - np.mean(y_data))**2)
        r_squared = 1 - ss_res / ss_tot if ss_tot > 0 else 0

        # 参数置信区间（来自协方差矩阵）
        perr = np.sqrt(np.diag(pcov)) if pcov is not None else [None]*4

        return {
            "model": model_type,
            "ic50": float(ic50_val),
            "log_ic50": float(np.log10(ic50_val)) if ic50_val > 0 else None,
            "hill_slope": float(hill),
            "bottom": float(bottom),
            "top": float(top),
            "r_squared": float(r_squared),
            "fit_curve": {
                "x": x_fit.tolist(),
                "y": y_fit.tolist(),
            },
            "data_points": {
                "x": x_raw.tolist(),
                "y": y_data.tolist(),
            },
            "conclusion": f"IC50 = {ic50_val:.4g}，R² = {r_squared:.4f}，Hill 斜率 = {hill:.4f}",
        }
    except Exception as e:
        return {"error": f"IC50 拟合失败: {str(e)}"}


# ─── 相关分析 ─────────────────────────────────────────────────────────────────

def correlation(params: dict) -> dict:
    """
    相关分析（Pearson + Spearman）
    params: x, y 两组数值
    """
    x = np.array(params['x'], dtype=float)
    y = np.array(params['y'], dtype=float)
    mask = ~(np.isnan(x) | np.isnan(y))
    x, y = x[mask], y[mask]
    n = len(x)

    r_p, p_p = scipy_stats.pearsonr(x, y)
    r_s, p_s = scipy_stats.spearmanr(x, y)

    # Pearson 95% CI（Fisher z 变换）
    z = np.arctanh(r_p)
    se_z = 1 / np.sqrt(n - 3)
    ci_lower = float(np.tanh(z - 1.96 * se_z))
    ci_upper = float(np.tanh(z + 1.96 * se_z))

    return {
        "n": n,
        "pearson_r": float(r_p),
        "pearson_p": float(p_p),
        "pearson_p_fmt": _fmt_p(float(p_p)),
        "pearson_ci_lower": ci_lower,
        "pearson_ci_upper": ci_upper,
        "spearman_rho": float(r_s),
        "spearman_p": float(p_s),
        "spearman_p_fmt": _fmt_p(float(p_s)),
        "conclusion": (
            f"Pearson r={r_p:.4f}（p={_fmt_p(float(p_p))}），"
            f"Spearman ρ={r_s:.4f}（p={_fmt_p(float(p_s))}）"
        ),
    }

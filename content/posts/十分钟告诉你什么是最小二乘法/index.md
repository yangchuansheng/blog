---
title: "最小二乘法的本质"
subtitle: "深入理解最小二乘法"
date: 2016-06-04T13:28:25Z
draft: false
author: 米开朗基杨
categories: "math"
tags: ["vector", "matrix"]
img: "https://cdn.jsdelivr.us/gh/yangchuansheng/imghosting5@main/uPic/2023-11-21-13-34-15XA2O.jpg"
bigimg: [{src: "https://hugo-picture.oss-cn-beijing.aliyuncs.com/blog/2019-04-27-080627.jpg"}]
libraries:
- katex
---

{{< katex >}}

曾经看过国内各种关于讲解最小二乘法的教科书，但都是一大堆枯燥的推导公式，看起来很高深的样子，其实根本不知道它在说些什么！传授知识本来就应该告诉你这个东西到底是什么，它到底是干嘛的，就应该把复杂的问题简单化，可国内大多数教科书都是反其道而行，全是看起来很牛逼的样子，学生看了却什么也不懂。今天我就用最通俗易懂的方式，从线性代数和线性空间的角度告诉你什么是最小二乘法。

------
最小二乘法是一种最优化技术，它的做法是找到一组估计值，使得估计值与实际值的平方和的值最小，通过使误差的平方和最小，我们可以得到一下线性方程组，对这个线性方程组进行求解就可以得到拟合曲线。我们可以通过一个例子来进行讲解。

假设有一组数据点$t_1$，$t_2$和$t_3$，它们的坐标分别是(1，1)，(2，2)，(3，2)，而我想找到最优的那条线，假设这条直线为：

$$y = C + Dt\tag{1}$$

它不会通过所有的点，因为不存在这样的直线，所以我要选一条最优的使总误差最小的直线。我们需要知道总误差怎么度量，因为它决定了哪条线胜出，我们必须先定出误差是什么，才能通过最小化这个量而找到C和D。在此我就不作图了，因为图像很简单，你们可以自己想象一下，或者自己拿笔画画。
将这三个点带入方程，得到：

<p>
$$
\begin{cases}
C + D = 1 \\
C + 2D =2 \\
C + 3D =2
\end{cases}\tag{2}
$$
</p>

通过计算我们知道，它们联立是无解的，但可以有最优解。
这个方程组可写成矩阵的形式
$$AX = B\tag{3}$$


其中，\\(A = \begin{bmatrix} 1 & 1 \\\1 & 2 \\\1 & 3 \end{bmatrix}\\)，\\(X = \begin{bmatrix} C & D \end{bmatrix}\\)，\\(B = \begin{bmatrix} 1 \\\2 \\\3 \end{bmatrix}\\)。

&emsp;&emsp;A的列向量线性无关，所以它们构成了列空间的一组基，但列空间不包括向量B，所以方程无解。那么最优解是什么呢？
我们将AX与B之间的差值相加，得到：

$$AX - B = E\tag{4}$$


其中，$E = \begin{bmatrix} e_1 \\\e_2 \\\e_3 \end{bmatrix}$，$e_1 = C + D - 1$，$e_2 = C + 2D - 2$，$e_3 = C + 3D - 2$，E称为误差向量。

我们要求的是$\left|AX - B\right|^2$ = $\left|E\right|^2$的最小值。

$$\left|E\right|^2 = \left|e_1\right|^2 + \left|e_2\right|^2 + \left|e_3\right|^2\tag{5}$$

分别过点$t_1$,$t_2$和$t_3$作与x轴垂直的直线，与直线y=C+Dt的交点分别为$s_1$,$s_2$,$s_3$。于是

<p>
$$
\begin{cases}
\left|e_1\right| = \left|t_1-s_1\right| \\
\left|e_2\right| = \left|t_2-s_2\right| \\
\left|e_3\right| = \left|t_3-s_3\right|
\end{cases}\tag{6}
$$
</p>

假设$s_1$,$s_2$,$s_3$的纵坐标分别为$p_1$,$p_2$,$p_3$，令$p = \begin{bmatrix}p_1 \\\p_2\\\p_3\end{bmatrix}$。

我们知道方程组$AX = B$是无解的，但方程组$AX = p$有解，我们来求解方程组$AX = p$。为了提醒自己这里表示的是最优的估计，而不是完美的结果，我们在X上面加个小帽子，使方程组变为

$$A\hat{X} = p\tag{7}$$

其中p是B在p向量这个方向上的投影，设投影矩阵为P，则

$$p = PB\tag{8}$$

如果不懂什么是投影矩阵，可以参考我的另一篇文章[子空间投影](/posts/子空间投影/)，在此不作赘述。
通过投影矩阵的知识我们知道投影矩阵P的表达式为

$$P = A(A^TA)^{-1}A^T\tag{9}$$

代入(8)，得：

$$p = A(A^TA)^{-1}A^TB\tag{10}$$

将(10)代入(7)，得：

$$A\hat{X} = A(A^TA)^{-1}A^TB$$

最后得到方程组为：

$$A^TAX = A^TB\tag{11}$$

解得

$$\hat{X} = \begin{bmatrix} \frac{2}{3} \\\ \frac{1}{2} \end{bmatrix}$$

这就是最优解，所以最优的那条直线为：

$$y = \frac{2}{3} + \frac{1}{2}t\tag{12}$$

// Seeds companies + a shared placeholder question bank (same content migrated once already
// for the superseded Postgres plan). All four companies point at the same question set for
// now — replace per-company content later directly in MongoDB, no schema change needed.
import 'dotenv/config';
import { getDb } from './db.js';

const COMPANIES = [
  { name: 'TCS', slug: 'tcs' },
  { name: 'Wipro', slug: 'wipro' },
  { name: 'Infosys', slug: 'infosys' },
  { name: 'General', slug: 'general' },
].map((c) => ({
  ...c,
  passThresholdPct: 60,
  technicalDurationMin: 60,
  englishDurationMin: 45,
  aptitudeDurationMin: 45,
  aiTechnicalDurationMin: 60,
  coding1DurationMin: 75,
  coding2DurationMin: 60,
  technicalInterviewDurationMin: 30,
  personalDurationMin: 45,
  hrDurationMin: 20,
  isActive: true,
  createdAt: new Date(),
}));

const TECHNICAL_QUESTIONS = [
  { qtype: 'mcq', category: 'DSA', prompt: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 'O(log n)', points: 2 },
  { qtype: 'mcq', category: 'DSA', prompt: 'Which data structure uses LIFO principle?', options: ['Queue', 'Stack', 'Array', 'Tree'], correctAnswer: 'Stack', points: 2 },
  { qtype: 'mcq', category: 'DSA', prompt: 'What is the worst-case time complexity of quicksort?', options: ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'], correctAnswer: 'O(n²)', points: 2 },
  { qtype: 'mcq', category: 'DSA', prompt: 'Which traversal technique is used in DFS?', options: ['Queue', 'Stack', 'Array', 'Linked List'], correctAnswer: 'Stack', points: 2 },
  { qtype: 'mcq', category: 'DSA', prompt: 'What is the space complexity of merge sort?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], correctAnswer: 'O(n)', points: 2 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'If a train travels 120 km in 2 hours, what is its speed?', options: ['50 km/h', '60 km/h', '70 km/h', '80 km/h'], correctAnswer: '60 km/h', points: 1 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'A man can complete a work in 12 days. How much work can he complete in 3 days?', options: ['1/4', '1/3', '1/2', '2/3'], correctAnswer: '1/4', points: 1 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'The ratio of 3:4 is equal to?', options: ['12:16', '6:9', '9:12', '15:18'], correctAnswer: '12:16', points: 1 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'If 5 books cost $25, what is the cost of 8 books?', options: ['$35', '$40', '$45', '$50'], correctAnswer: '$40', points: 1 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'What comes next in the series: 2, 6, 12, 20, ?', options: ['28', '30', '32', '34'], correctAnswer: '30', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'What is 15% of 240?', options: ['36', '32', '38', '34'], correctAnswer: '36', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'If x + y = 10 and x - y = 4, what is the value of x?', options: ['6', '7', '8', '9'], correctAnswer: '7', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'What is the area of a circle with radius 7?', options: ['154', '144', '164', '174'], correctAnswer: '154', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'If log₂(8) = x, what is x?', options: ['2', '3', '4', '5'], correctAnswer: '3', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'What is the compound interest on $1000 at 10% for 2 years?', options: ['$200', '$210', '$220', '$230'], correctAnswer: '$210', points: 1 },
  { qtype: 'coding', category: 'DSA', prompt: 'Write a function to reverse a linked list.', options: null, correctAnswer: 'iterative or recursive approach', points: 5 },
  { qtype: 'coding', category: 'DSA', prompt: 'Implement binary search algorithm.', options: null, correctAnswer: 'divide and conquer approach', points: 5 },
  { qtype: 'coding', category: 'DSA', prompt: 'Find the maximum element in an array.', options: null, correctAnswer: 'iterate through array', points: 3 },
  { qtype: 'coding', category: 'DSA', prompt: 'Check if a string is palindrome.', options: null, correctAnswer: 'two pointer approach', points: 3 },
  { qtype: 'coding', category: 'DSA', prompt: 'Implement stack using arrays.', options: null, correctAnswer: 'push, pop, top operations', points: 4 },
  { qtype: 'mcq', category: 'DSA', prompt: 'What is the height of a complete binary tree with n nodes?', options: ['log₂(n)', '⌊log₂(n)⌋', '⌈log₂(n+1)⌉', 'n'], correctAnswer: '⌊log₂(n)⌋', points: 2 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'A pipe can fill a tank in 6 hours. Another pipe can empty it in 8 hours. How long to fill the tank if both are open?', options: ['24 hours', '20 hours', '18 hours', '16 hours'], correctAnswer: '24 hours', points: 1 },
  { qtype: 'mcq', category: 'Quant', prompt: 'What is the probability of getting a head when flipping a fair coin?', options: ['0.25', '0.5', '0.75', '1'], correctAnswer: '0.5', points: 1 },
  { qtype: 'mcq', category: 'DSA', prompt: 'Which sorting algorithm is stable?', options: ['Quick Sort', 'Heap Sort', 'Merge Sort', 'Selection Sort'], correctAnswer: 'Merge Sort', points: 2 },
  { qtype: 'mcq', category: 'Aptitude', prompt: 'If today is Monday, what day will it be after 100 days?', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], correctAnswer: 'Tuesday', points: 1 },
];

const CODING1_QUESTIONS = [
  {
    qtype: 'coding',
    category: 'DSA · Sliding Window',
    prompt: 'Longest Stable Uptime Window',
    description: 'A monitoring service records the number of successful requests handled by each minute. Find the length of the longest contiguous window whose total requests are at most the given capacity. The window must contain at least one minute.',
    inputFormat: 'The first line contains n and capacity. The second line contains n non-negative integers requests[i].',
    outputFormat: 'Print the maximum length of a contiguous window whose sum is at most capacity.',
    constraints: ['1 <= n <= 200000', '0 <= requests[i] <= 1000000000', '1 <= capacity <= 100000000000000'],
    examples: [
      { input: '5 7\\n2 1 3 4 1', output: '3', explanation: 'The window [2, 1, 3] has sum 6 and length 3.' },
      { input: '4 3\\n4 1 1 1', output: '3', explanation: 'The last three values have sum 3.' },
    ],
    visibleTestCases: 5,
    hiddenTestCases: 20,
    supportedLanguages: ['C', 'C++', 'Java', 'Python'],
    starterCode: {
      C: '#include <stdio.h>\\n\\nint main(void) {\\n    // Read input, solve the problem, and print one integer.\\n    return 0;\\n}',
      'C++': '#include <bits/stdc++.h>\\nusing namespace std;\\n\\nint main() {\\n    // Read input, solve the problem, and print one integer.\\n    return 0;\\n}',
      Java: 'import java.io.*;\\nimport java.util.*;\\n\\npublic class Main {\\n    public static void main(String[] args) throws Exception {\\n        // Read input, solve the problem, and print one integer.\\n    }\\n}',
      Python: 'import sys\\n\\ndef solve():\\n    # Read input, solve the problem, and print one integer.\\n    pass\\n\\nif __name__ == \"__main__\":\\n    solve()',
    },
    correctAnswer: 'Sliding window with two pointers and a running sum; O(n) time and O(1) extra space.',
    points: 50,
  },
  {
    qtype: 'coding',
    category: 'DSA · Graphs',
    prompt: 'Minimum Hops in a Service Network',
    description: 'Services are connected by one-way deployment links. Given a start service and a target service, return the minimum number of links needed to reach the target. If the target cannot be reached, return -1.',
    inputFormat: 'The first line contains n, m, start, and target. The next m lines contain directed edges u v, meaning a link from u to v. Services are numbered 0 through n-1.',
    outputFormat: 'Print the minimum number of links from start to target, or -1 when no route exists.',
    constraints: ['1 <= n <= 100000', '0 <= m <= 200000', '0 <= u, v < n', 'start and target are valid service ids'],
    examples: [
      { input: '6 7 0 5\\n0 1\\n0 2\\n1 3\\n2 3\\n3 4\\n4 5\\n2 5', output: '2', explanation: 'The shortest route is 0 -> 2 -> 5.' },
      { input: '4 2 0 3\\n0 1\\n1 2', output: '-1', explanation: 'Service 3 is unreachable.' },
    ],
    visibleTestCases: 5,
    hiddenTestCases: 20,
    supportedLanguages: ['C', 'C++', 'Java', 'Python'],
    starterCode: {
      C: '#include <stdio.h>\\n\\nint main(void) {\\n    // Build the graph, run BFS, and print the shortest distance.\\n    return 0;\\n}',
      'C++': '#include <bits/stdc++.h>\\nusing namespace std;\\n\\nint main() {\\n    // Build the graph, run BFS, and print the shortest distance.\\n    return 0;\\n}',
      Java: 'import java.io.*;\\nimport java.util.*;\\n\\npublic class Main {\\n    public static void main(String[] args) throws Exception {\\n        // Build the graph, run BFS, and print the shortest distance.\\n    }\\n}',
      Python: 'import sys\\nfrom collections import deque\\n\\ndef solve():\\n    # Build the graph, run BFS, and print the shortest distance.\\n    pass\\n\\nif __name__ == \"__main__\":\\n    solve()',
    },
    correctAnswer: 'Breadth-first search from start with a visited array; the first distance assigned to target is minimum. O(n + m) time.',
    points: 50,
  },
];

const CODING2_QUESTIONS = [
  {
    qtype: 'coding',
    category: 'AI-Assisted DSA',
    mode: 'ai_assisted',
    prompt: 'Incident-Aware Request Routing',
    description: 'During a production incident, requests arrive at services connected by directed routing links. Starting from service 0, compute the minimum number of links needed to reach every service. If a service is unreachable, output -1. You may use the AI assistant to discuss algorithms, edge cases, or implementation ideas, but you must write and submit the final code.',
    caseStudy: 'A deployment platform uses this metric to decide whether traffic can be rerouted within the incident response latency budget.',
    inputFormat: 'The first line contains n and m. The next m lines contain directed edges u v. Service 0 is the source.',
    outputFormat: 'Print n space-separated minimum distances from service 0. The distance to service 0 is 0; unreachable services are -1.',
    constraints: ['1 <= n <= 100000', '0 <= m <= 200000', '0 <= u, v < n', 'Duplicate edges may appear'],
    examples: [
      { input: '5 5\\n0 1\\n0 2\\n1 3\\n2 3\\n3 4', output: '0 1 1 2 3', explanation: 'Breadth-first search visits services in increasing hop distance.' },
      { input: '4 2\\n0 1\\n2 3', output: '0 1 -1 -1', explanation: 'Services 2 and 3 cannot be reached from service 0.' },
    ],
    visibleTestCases: 5,
    hiddenTestCases: 20,
    supportedLanguages: ['Python', 'C', 'C++', 'Java'],
    assistanceTokenLimit: 2000,
    starterCode: {
      Python: 'import sys\\nfrom collections import deque\\n\\ndef solve():\\n    # Read the graph, run BFS from 0, and print all distances.\\n    pass\\n\\nif __name__ == "__main__":\\n    solve()',
      C: '#include <stdio.h>\\n\\nint main(void) {\\n    // Read the graph, run BFS from 0, and print all distances.\\n    return 0;\\n}',
      'C++': '#include <bits/stdc++.h>\\nusing namespace std;\\n\\nint main() {\\n    // Read the graph, run BFS from 0, and print all distances.\\n    return 0;\\n}',
      Java: 'import java.io.*;\\nimport java.util.*;\\n\\npublic class Main {\\n    public static void main(String[] args) throws Exception {\\n        // Read the graph, run BFS from 0, and print all distances.\\n    }\\n}',
    },
    correctAnswer: 'Use breadth-first search with an adjacency list and a distance array initialized to -1. O(n + m) time.',
    points: 50,
  },
  {
    qtype: 'coding',
    category: 'Debugging',
    mode: 'debugging',
    prompt: 'Debug the Sliding Window Implementation',
    description: 'The following implementation should return the length of the longest contiguous subarray whose sum is at most capacity. It fails on some edge cases. Find and fix the bug, then submit the corrected code in your selected language.',
    caseStudy: 'This utility is used by a monitoring dashboard to find the longest period that stays within an operations capacity budget.',
    inputFormat: 'The first line contains n and capacity. The second line contains n non-negative integers.',
    outputFormat: 'Print the maximum valid window length.',
    constraints: ['1 <= n <= 200000', '0 <= values[i] <= 1000000000', '1 <= capacity <= 100000000000000'],
    examples: [
      { input: '5 7\\n2 1 3 4 1', output: '3', explanation: 'The corrected code must shrink the window until its sum is valid.' },
      { input: '4 3\\n4 1 1 1', output: '3', explanation: 'A value larger than capacity must not prevent later valid windows.' },
    ],
    visibleTestCases: 5,
    hiddenTestCases: 20,
    supportedLanguages: ['Python', 'C', 'C++', 'Java'],
    starterCode: {
      Python: 'def longest_window(values, capacity):\\n    left = 0\\n    total = 0\\n    best = 0\\n    for right, value in enumerate(values):\\n        total += value\\n        while total < capacity:  # BUG: this condition is incorrect\\n            total -= values[left]\\n            left += 1\\n        best = max(best, right - left + 1)\\n    return best',
      C: 'int longestWindow(const long long values[], int n, long long capacity) {\\n    int left = 0, best = 0;\\n    long long total = 0;\\n    for (int right = 0; right < n; right++) {\\n        total += values[right];\\n        while (total < capacity) { /* BUG: this condition is incorrect */\\n            total -= values[left++];\\n        }\\n        int length = right - left + 1;\\n        if (length > best) best = length;\\n    }\\n    return best;\\n}',
      'C++': 'int longestWindow(const vector<long long>& values, long long capacity) {\\n    int left = 0, best = 0;\\n    long long total = 0;\\n    for (int right = 0; right < (int)values.size(); right++) {\\n        total += values[right];\\n        while (total < capacity) { // BUG: this condition is incorrect\\n            total -= values[left++];\\n        }\\n        best = max(best, right - left + 1);\\n    }\\n    return best;\\n}',
      Java: 'static int longestWindow(long[] values, long capacity) {\\n    int left = 0, best = 0;\\n    long total = 0;\\n    for (int right = 0; right < values.length; right++) {\\n        total += values[right];\\n        while (total < capacity) { // BUG: this condition is incorrect\\n            total -= values[left++];\\n        }\\n        best = Math.max(best, right - left + 1);\\n    }\\n    return best;\\n}',
    },
    correctAnswer: 'Change the shrinking condition from total < capacity to total > capacity, then update best.',
    points: 50,
  },
];

const TECHNICAL_INTERVIEW_QUESTIONS = [
  { qtype: 'behavioral', category: 'CV Experience', subtopic: 'Project Ownership', prompt: 'Walk through the project on your CV that best demonstrates your technical ownership. Explain the architecture, your contribution, and one trade-off you made.', correctAnswer: 'Clear project context, personal contribution, architecture reasoning, and trade-off', points: 10 },
  { qtype: 'behavioral', category: 'CV Experience', subtopic: 'Technical Depth', prompt: 'Choose one technology listed on your CV and explain how you used it in production or a realistic project. What limitation did you encounter?', correctAnswer: 'Specific implementation details, limitations, and informed technical reasoning', points: 10 },
  { qtype: 'behavioral', category: 'Problem Solving', subtopic: 'Debugging', prompt: 'Describe a difficult bug or production issue related to your CV experience. How did you isolate the cause, verify the fix, and prevent recurrence?', correctAnswer: 'Reproducible diagnosis, evidence-based fix, verification, and prevention', points: 10 },
  { qtype: 'behavioral', category: 'System Design', subtopic: 'Scalability', prompt: 'Take a system or application from your CV and explain how you would scale it for ten times the current traffic while keeping it reliable.', correctAnswer: 'Bottleneck analysis, caching or partitioning, observability, and failure handling', points: 10 },
  { qtype: 'behavioral', category: 'Communication', subtopic: 'Technical Decisions', prompt: 'Tell us about a technical decision from your CV that you would make differently today. What did you learn?', correctAnswer: 'Honest reflection, specific decision context, learning, and improvement', points: 10 },
];

const PERSONAL_QUESTIONS = [
  { prompt: 'Implement a function to reverse a linked list.', correctAnswer: 'Iterative or recursive reversal', points: 10 },
  { prompt: 'Find the longest palindromic substring in a given string.', correctAnswer: 'Expand around centers or dynamic programming', points: 10 },
  { prompt: 'Implement binary search in a sorted array.', correctAnswer: 'Divide and conquer with two pointers', points: 8 },
  { prompt: 'Detect if a linked list has a cycle.', correctAnswer: "Floyd's cycle detection (tortoise and hare)", points: 10 },
  { prompt: 'Find the maximum depth of a binary tree.', correctAnswer: 'Recursive DFS or iterative BFS', points: 8 },
  { prompt: 'Merge two sorted arrays in-place.', correctAnswer: 'Two pointers from end to beginning', points: 10 },
  { prompt: 'Find the first non-repeating character in a string.', correctAnswer: 'Hash map for frequency counting', points: 8 },
  { prompt: 'Implement a stack using queues.', correctAnswer: 'Two queues or one queue with rotation', points: 10 },
  { prompt: 'Find the kth largest element in an array.', correctAnswer: 'Quick select or heap', points: 10 },
  { prompt: 'Check if two strings are anagrams.', correctAnswer: 'Sorting or character frequency counting', points: 8 },
].map((q) => ({ ...q, qtype: 'coding', category: 'DSA', options: null }));

const HR_QUESTIONS = [
  { prompt: "Tell me about yourself and why you're interested in this position.", correctAnswer: 'background experience skills interest role motivation career goals' },
  { prompt: 'Describe a challenging situation you faced and how you overcame it.', correctAnswer: 'challenge problem obstacle solution action result overcame learned' },
  { prompt: 'Where do you see yourself in five years?', correctAnswer: 'career growth goals development future plan aspiration' },
  { prompt: 'What are your greatest strengths and weaknesses?', correctAnswer: 'strength weakness self awareness improvement skill' },
  { prompt: 'Why should we hire you over other candidates?', correctAnswer: 'unique value skills experience fit contribution strength' },
  { prompt: 'Describe a time when you had to work in a team to achieve a goal.', correctAnswer: 'team collaboration goal cooperation communication result' },
  { prompt: 'How do you handle stress and pressure?', correctAnswer: 'stress pressure manage cope prioritize calm strategy' },
  { prompt: 'What motivates you in your work?', correctAnswer: 'motivation passion drive purpose reward growth' },
  { prompt: 'Tell me about a time you failed and what you learned from it.', correctAnswer: 'failure mistake lesson learned improvement growth reflection' },
  { prompt: 'How do you stay updated with industry trends and technologies?', correctAnswer: 'learning trends technology industry courses reading updated' },
].map((q) => ({ ...q, qtype: 'behavioral', category: 'Behavioral', options: null, points: 1 }));

const APTITUDE_QUESTIONS = [
  ['A can complete a task in 12 days and B in 18 days. Working together, how long will they take?', ['6 days', '7.2 days', '8 days', '9 days'], '7.2 days'],
  ['A 20% acid solution and a 50% acid solution are mixed to obtain 32% acid. What is the ratio of the two solutions?', ['2:3', '3:2', '4:3', '5:2'], '3:2'],
  ['What is the remainder when 7^100 is divided by 13?', ['3', '7', '9', '11'], '9'],
  ['What is the probability of drawing exactly two aces in a 5-card hand?', ['C(4,2)C(48,3)/C(52,5)', 'C(4,2)C(48,2)/C(52,5)', 'C(4,1)C(48,4)/C(52,5)', 'C(4,2)/C(52,5)'], 'C(4,2)C(48,3)/C(52,5)'],
  ['Find the next term: 3, 8, 15, 24, 35, ...', ['46', '48', '50', '52'], '48'],
  ['For a principal of $10,000 at 10% per annum, what is the difference between compound interest and simple interest for 2 years?', ['$10', '$100', '$110', '$210'], '$100'],
  ['A pipe fills a tank in 12 hours, another in 18 hours, and a leak empties it in 36 hours. How long do all three take together?', ['6 hours', '8 hours', '9 hours', '12 hours'], '9 hours'],
  ['A 180 m train travels at 54 km/h. How long does it take to pass a 240 m platform?', ['20 seconds', '24 seconds', '28 seconds', '32 seconds'], '28 seconds'],
  ['How many distinct arrangements can be made from all letters of MISSISSIPPI?', ['34,650', '36,450', '39,600', '41,580'], '34,650'],
  ['If x + 1/x = 3, where x is non-zero, what is x^3 + 1/x^3?', ['9', '18', '21', '27'], '18'],
  ['A boat travels at 15 km/h in still water and the stream is 3 km/h. How far upstream can it travel in 4 hours?', ['36 km', '42 km', '48 km', '60 km'], '48 km'],
  ['The present ages of A and B are in the ratio 4:5. After 6 years, their ratio will be 5:6. What is A’s present age?', ['18 years', '24 years', '30 years', '36 years'], '24 years'],
  ['Find the least positive number that leaves remainders 3, 4, and 5 when divided by 5, 7, and 9 respectively.', ['53', '58', '68', '73'], '68'],
  ['If log₂(x) + log₂(x - 2) = 3, find x.', ['2', '3', '4', '8'], '4'],
  ['Four fair dice are rolled. What is the probability of getting at least one six?', ['625/1296', '671/1296', '731/1296', '1/6'], '671/1296'],
  ['A person travels equal distances at 60 km/h and 40 km/h. What is the average speed?', ['48 km/h', '50 km/h', '52 km/h', '54 km/h'], '48 km/h'],
  ['A sum amounts to $13,310 in 3 years at 10% compound interest annually. What was the principal?', ['$9,000', '$10,000', '$11,000', '$12,000'], '$10,000'],
  ['A and B have efficiency ratio 3:2. Together they complete a job in 10 days. How many days would A alone take?', ['12 days', '15 days', '16 2/3 days', '20 days'], '16 2/3 days'],
  ['What is the smaller angle between the hands of a clock at 3:40?', ['110°', '120°', '130°', '140°'], '130°'],
  ['A triangle has sides 13, 14, and 15. What is its area?', ['72', '84', '96', '108'], '84'],
  ['A invests $5,000 for 12 months, B $8,000 for 9 months, and C $10,000 for 6 months. What is their profit-sharing ratio?', ['4:5:4', '5:6:5', '5:8:6', '6:7:6'], '5:6:5'],
  ['An item is discounted by 20% and then marked up by 25%. Compared with its original price, the final price is:', ['5% higher', 'The same', '5% lower', '10% higher'], 'The same'],
  ['How many trailing zeroes are there in 100!?', ['20', '22', '24', '25'], '24'],
  ['If x:y = 3:4 and y:z = 8:5, what is x:y:z?', ['3:8:5', '6:8:5', '6:4:5', '3:4:5'], '6:8:5'],
  ['The roots of x² - 7x + 12 = 0 are:', ['1 and 12', '2 and 6', '3 and 4', '−3 and −4'], '3 and 4'],
  ['A rectangle has perimeter 40 units. What is the maximum possible area?', ['80', '90', '100', '120'], '100'],
  ['Find the sum of the first five terms of the geometric progression 2, 6, 18, ...', ['120', '162', '242', '486'], '242'],
  ['A 10 L solution is reduced by removing 2 L and replacing it with water twice. What percentage of the original solute remains?', ['36%', '60%', '64%', '80%'], '64%'],
  ['Two runners on a 400 m circular track run at 8 m/s and 6 m/s in the same direction. After how long will the faster runner first catch the slower runner?', ['100 seconds', '150 seconds', '200 seconds', '400 seconds'], '200 seconds'],
  ['A number is increased by 20% and then decreased by 20%. What is the net percentage change?', ['0%', '4% increase', '4% decrease', '8% decrease'], '4% decrease'],
].map(([prompt, options, correctAnswer]) => ({ qtype: 'mcq', category: 'Hard Aptitude', prompt, options, correctAnswer, points: 1 }));

const AI_TECHNICAL_QUESTIONS = [
  ['A RAG assistant cites an outdated policy despite a newer document being indexed. What is the strongest first fix?', ['Increase temperature', 'Add document version/date filtering and retrieval evaluation', 'Use a larger chat window only', 'Remove citations'], 'Add document version/date filtering and retrieval evaluation'],
  ['An agent repeatedly calls a payment API after receiving a timeout. Which control best prevents duplicate charges?', ['Higher temperature', 'Idempotency keys and bounded retry policy', 'Longer prompts', 'Removing logs'], 'Idempotency keys and bounded retry policy'],
  ['A company wants an LLM to answer only from approved internal documents and admit uncertainty. Which design is best?', ['Fine-tune on random web pages', 'RAG with access control, citations, and a confidence/abstention policy', 'Disable retrieval', 'Use maximum token output'], 'RAG with access control, citations, and a confidence/abstention policy'],
  ['An agent can approve refunds. What is the safest production architecture?', ['Let the model call the refund API directly', 'Require policy checks and human approval for high-value or anomalous refunds', 'Hide the API schema from logs', 'Allow unlimited tool calls'], 'Require policy checks and human approval for high-value or anomalous refunds'],
  ['A RAG system retrieves five semantically similar but irrelevant chunks. Which change most directly improves precision?', ['Increase top-k substantially', 'Add metadata filters, reranking, and domain-specific retrieval evaluation', 'Increase temperature', 'Shorten the user question'], 'Add metadata filters, reranking, and domain-specific retrieval evaluation'],
  ['A support LLM exposes another customer’s record when asked a cleverly worded question. What failed primarily?', ['UI styling', 'Authorization enforcement at retrieval/tool boundaries', 'Embedding dimension', 'Tokenization speed'], 'Authorization enforcement at retrieval/tool boundaries'],
  ['Which metric best evaluates whether retrieved context contains the evidence needed to answer?', ['GPU utilization', 'Context recall/answer-supported retrieval evaluation', 'CSS coverage', 'Prompt length'], 'Context recall/answer-supported retrieval evaluation'],
  ['An agent planner generates an unsafe shell command. Which defense is strongest?', ['Ask the model to be careful', 'Use an allowlisted tool interface with validation and sandboxing', 'Increase context length', 'Hide the command output'], 'Use an allowlisted tool interface with validation and sandboxing'],
  ['A team needs consistent JSON from an LLM for an underwriting workflow. What is most reliable?', ['Parse arbitrary prose with regex only', 'Use schema-constrained output plus server-side validation', 'Ask for JSON once', 'Ignore malformed fields'], 'Use schema-constrained output plus server-side validation'],
  ['A model performs well on a benchmark but fails on regional customer language. What should the team do first?', ['Delete the benchmark', 'Build a representative evaluation set and analyze subgroup performance', 'Increase temperature', 'Remove user feedback'], 'Build a representative evaluation set and analyze subgroup performance'],
  ['What is the main benefit of hybrid search in an enterprise RAG system?', ['It eliminates authorization', 'It combines lexical exact-match signals with semantic similarity', 'It guarantees factuality', 'It removes the need for chunking'], 'It combines lexical exact-match signals with semantic similarity'],
  ['An agent has a goal but no stopping condition and keeps browsing. Which design change is needed?', ['More tools', 'Budgeted steps, deadlines, and explicit termination criteria', 'Higher temperature', 'Longer system prompt only'], 'Budgeted steps, deadlines, and explicit termination criteria'],
  ['A prompt injection appears inside a retrieved document instructing the assistant to ignore policy. What should retrieval content be treated as?', ['Higher priority than system instructions', 'Untrusted data separated from instructions', 'A trusted developer message', 'Executable code'], 'Untrusted data separated from instructions'],
  ['A team wants to reduce LLM latency without changing answer quality significantly. Which approach is appropriate?', ['Send all documents every time', 'Cache stable results, reduce unnecessary context, and route simple tasks to smaller models', 'Increase max tokens', 'Disable monitoring'], 'Cache stable results, reduce unnecessary context, and route simple tasks to smaller models'],
  ['A generated answer is fluent but invents a nonexistent API field. What type of failure is this?', ['Hallucination', 'Deadlock', 'Normalization', 'Packet loss'], 'Hallucination'],
  ['For a customer-data agent, which log practice is safest?', ['Log full prompts including secrets', 'Redact sensitive fields and retain auditable tool decisions', 'Disable all logs', 'Store credentials in prompts'], 'Redact sensitive fields and retain auditable tool decisions'],
  ['When is fine-tuning generally preferable to RAG?', ['When answers require changing private facts daily', 'When behavior/style or task format needs adaptation using stable training examples', 'When authorization is absent', 'When no evaluation data exists'], 'When behavior/style or task format needs adaptation using stable training examples'],
  ['A multi-agent workflow produces contradictory summaries. Which control helps most?', ['Let every agent write to production', 'Define typed contracts, a verifier step, and a single authority for final state', 'Remove all intermediate outputs', 'Increase randomness'], 'Define typed contracts, a verifier step, and a single authority for final state'],
  ['What is the strongest way to test an LLM safety guardrail?', ['One happy-path example', 'Adversarial and regression test suites with measurable pass criteria', 'A larger logo', 'Manual testing once'], 'Adversarial and regression test suites with measurable pass criteria'],
  ['A RAG answer cites a chunk that supports only half of its claim. What should improve?', ['Citation grounding and claim-level verification', 'Temperature only', 'UI animation', 'Database indexing unrelated fields'], 'Citation grounding and claim-level verification'],
  ['A financial transaction table has repeating customer phone numbers and update anomalies. Which DBMS fix is appropriate?', ['Denormalize everything', 'Normalize entities and enforce foreign keys', 'Store all values in one text field', 'Remove constraints'], 'Normalize entities and enforce foreign keys'],
  ['Two transactions read the same stock quantity and both sell the last item. Which issue occurred?', ['Dirty write only', 'Lost update/race condition', 'DNS failure', 'Memory leak'], 'Lost update/race condition'],
  ['Which index best supports WHERE tenant_id = ? AND created_at BETWEEN ? AND ? ORDER BY created_at?', ['Index on an unrelated text column', 'Composite index on (tenant_id, created_at)', 'Index on a boolean only', 'No index ever'], 'Composite index on (tenant_id, created_at)'],
  ['A REST API must safely retry order creation. Which design is best?', ['POST without a request key', 'Idempotency key persisted with the order result', 'Ignore duplicate requests', 'Use client timestamps only'], 'Idempotency key persisted with the order result'],
  ['A subclass violates a caller assumption established by its base class. Which OOP principle is broken?', ['Liskov substitution principle', 'Encapsulation only', 'Operator precedence', 'Garbage collection'], 'Liskov substitution principle'],
  ['A browser sends a preflight OPTIONS request before a cross-origin JSON request. What is being enforced?', ['CORS policy', 'DNS recursion', 'TLS key rotation', 'Database normalization'], 'CORS policy'],
  ['A service must process millions of events and tolerate consumer downtime. Which pattern is most suitable?', ['Synchronous request per event only', 'Durable message broker with consumer offsets and retry/dead-letter handling', 'Local variables only', 'Browser localStorage'], 'Durable message broker with consumer offsets and retry/dead-letter handling'],
  ['A cache returns stale user permissions after revocation. Which control is essential?', ['Longer TTL always', 'Permission-aware invalidation or short bounded TTL with authoritative checks', 'Ignore revocations', 'Client-side caching only'], 'Permission-aware invalidation or short bounded TTL with authoritative checks'],
  ['A web application renders user-provided HTML without escaping. Which vulnerability is likely?', ['Cross-site scripting', 'Deadlock', 'ARP spoofing only', 'Disk fragmentation'], 'Cross-site scripting'],
  ['A server accepts a user-supplied object path and reads arbitrary files. Which issue is present?', ['Path traversal', 'CSS specificity', 'Load balancing', 'Connection pooling'], 'Path traversal'],
  ['A database query is slow because a function wraps the indexed timestamp column in the WHERE clause. What is a likely fix?', ['Use a sargable range predicate without wrapping the indexed column', 'Drop all indexes', 'Add random joins', 'Convert dates to UI strings'], 'Use a sargable range predicate without wrapping the indexed column'],
  ['A distributed service needs to prevent an operation from being applied twice after retry. Which combination helps?', ['Idempotency key and durable operation state', 'Random sleep only', 'More frontend validation', 'No response handling'], 'Idempotency key and durable operation state'],
  ['What does TLS primarily provide for an HTTPS connection?', ['Confidentiality, integrity, and server authentication', 'Database joins', 'Application caching', 'UI rendering'], 'Confidentiality, integrity, and server authentication'],
  ['A DNS record was changed but clients still reach the old server. What most likely explains this?', ['Cached DNS data within its TTL', 'SQL isolation', 'OOP inheritance', 'JWT hashing'], 'Cached DNS data within its TTL'],
  ['A React page fetches data after unmount and updates stale state. Which design prevents this?', ['Abort/cancel the request or guard updates on cleanup', 'Increase image size', 'Disable HTTPS', 'Use a global mutable singleton'], 'Abort/cancel the request or guard updates on cleanup'],
  ['A password database is stolen. Which storage approach limits offline cracking risk?', ['Plaintext passwords', 'Slow salted password hashing such as bcrypt or Argon2', 'Base64 encoding', 'A reversible encryption key in the same table'], 'Slow salted password hashing such as bcrypt or Argon2'],
  ['A service has many short-lived outbound HTTP calls and exhausts sockets. What improves reuse?', ['Connection pooling with bounded limits and timeouts', 'Disable timeouts', 'Create a new process per request', 'Retry forever'], 'Connection pooling with bounded limits and timeouts'],
  ['A deployment must release a schema change without breaking the previous application version. Which migration strategy is safest?', ['Destructive change first', 'Expand-and-contract with backward-compatible intermediate schema', 'Drop the table during peak traffic', 'Modify production manually'], 'Expand-and-contract with backward-compatible intermediate schema'],
  ['A WebSocket client reconnects rapidly during an outage and overloads the service. What should be added?', ['Exponential backoff with jitter and a reconnect cap', 'Immediate infinite retries', 'More browser tabs', 'No connection state'], 'Exponential backoff with jitter and a reconnect cap'],
  ['A database-backed API experiences traffic spikes that overwhelm the primary database. Which first architectural control is most appropriate?', ['Add bounded caching and read replicas for eligible reads', 'Send every request directly to the primary forever', 'Disable connection limits', 'Remove query timeouts'], 'Add bounded caching and read replicas for eligible reads'],
].map(([prompt, options, correctAnswer], index) => ({
  qtype: 'mcq',
  category: index < 20 ? 'AI Literacy' : 'Technical Knowledge',
  prompt,
  options,
  correctAnswer,
  points: 1,
}));

const ENGLISH_QUESTIONS = [
  {
    qtype: 'mcq', category: 'Listening Comprehension', passage: null,
    audioText: 'Many cities are redesigning public transport to reduce traffic and pollution. Electric buses are quieter and produce no exhaust at street level. However, they require charging stations and careful planning. The most successful programs combine reliable schedules with affordable fares so that residents choose buses instead of private cars.',
    prompt: 'What is one benefit of electric buses mentioned in the passage?',
    options: ['They require no planning', 'They are quieter and produce no street-level exhaust', 'They are always cheaper than cars', 'They never need charging'],
    correctAnswer: 'They are quieter and produce no street-level exhaust', points: 1,
  },
  {
    qtype: 'mcq', category: 'Listening Comprehension', passage: null,
    audioText: 'A community library introduced a weekend skill-sharing program. Local residents volunteer to teach photography, basic coding, cooking, and financial planning. The library provides the space and equipment, while participants bring practical experience. Attendance has grown because the sessions are informal, free, and focused on useful everyday skills.',
    prompt: 'Why has attendance at the skill-sharing program grown?',
    options: ['The sessions are expensive', 'Only professionals may attend', 'The sessions are informal, free, and practical', 'The library stopped lending books'],
    correctAnswer: 'The sessions are informal, free, and practical', points: 1,
  },
  ...[
    ['What do electric buses require in addition to vehicles?', ['Charging stations and careful planning', 'Private garages for every resident', 'More exhaust pipes', 'Longer traffic jams'], 'Charging stations and careful planning'],
    ['What combination encourages residents to choose public transport?', ['Reliable schedules and affordable fares', 'Higher fares and fewer buses', 'No schedules and expensive tickets', 'Private cars and free parking'], 'Reliable schedules and affordable fares'],
    ['What problem are cities trying to reduce?', ['Traffic and pollution', 'Library attendance', 'Cooking costs', 'Office meetings'], 'Traffic and pollution'],
    ['Where do electric buses produce no exhaust according to the audio?', ['At street level', 'Inside libraries', 'Only at stations', 'Underwater'], 'At street level'],
    ['Who teaches in the library skill-sharing program?', ['Local residents', 'Only visiting celebrities', 'Bus drivers only', 'No volunteers'], 'Local residents'],
    ['Which topic is explicitly mentioned as a class?', ['Basic coding', 'Advanced medicine', 'Airline piloting', 'Mountain rescue'], 'Basic coding'],
    ['What does the library provide?', ['Space and equipment', 'Private cars', 'All participant salaries', 'University degrees'], 'Space and equipment'],
    ['What do participants bring to the sessions?', ['Practical experience', 'A new building', 'Bus batteries', 'Traffic signals'], 'Practical experience'],
  ].map(([prompt, options, correctAnswer], index) => ({
    qtype: 'mcq',
    category: 'Listening Comprehension',
    passage: null,
    audioText: index < 4
      ? 'Many cities are redesigning public transport to reduce traffic and pollution. Electric buses are quieter and produce no exhaust at street level. However, they require charging stations and careful planning. The most successful programs combine reliable schedules with affordable fares so that residents choose buses instead of private cars.'
      : 'A community library introduced a weekend skill-sharing program. Local residents volunteer to teach photography, basic coding, cooking, and financial planning. The library provides the space and equipment, while participants bring practical experience. Attendance has grown because the sessions are informal, free, and focused on useful everyday skills.',
    prompt,
    options,
    correctAnswer,
    points: 1,
  })),
  {
    qtype: 'mcq', category: 'Reading Comprehension', passage: 'Remote work can improve flexibility, but it also requires deliberate communication. Teams that document decisions, schedule focused meetings, and make responsibilities visible are less likely to duplicate work. Successful remote teams do not communicate constantly; instead, they communicate clearly at the moments when context or a decision is needed.',
    prompt: 'According to the passage, what helps remote teams avoid duplicated work?',
    options: ['Constant meetings', 'Documenting decisions and making responsibilities visible', 'Avoiding all written communication', 'Working without assigned responsibilities'],
    correctAnswer: 'Documenting decisions and making responsibilities visible', points: 1,
  },
  {
    qtype: 'mcq', category: 'Reading Comprehension', passage: 'Remote work can improve flexibility, but it also requires deliberate communication. Teams that document decisions, schedule focused meetings, and make responsibilities visible are less likely to duplicate work. Successful remote teams do not communicate constantly; instead, they communicate clearly at the moments when context or a decision is needed.',
    prompt: 'What communication style does the author recommend?',
    options: ['Continuous communication without decisions', 'Clear communication when context or a decision is needed', 'No meetings under any circumstances', 'Only verbal communication'],
    correctAnswer: 'Clear communication when context or a decision is needed', points: 1,
  },
  ...[
    ['The manager approved the proposal after reviewing the budget.', 'What happened after the manager reviewed the budget?', ['The proposal was rejected', 'The proposal was approved', 'The budget was cancelled', 'The manager resigned'], 'The proposal was approved'],
    ['Regular exercise improves concentration because it increases blood flow to the brain.', 'Why can regular exercise improve concentration?', ['It reduces blood flow', 'It increases blood flow to the brain', 'It removes the need for sleep', 'It prevents all illness'], 'It increases blood flow to the brain'],
    ['The workshop was postponed because the speaker was ill.', 'Why was the workshop postponed?', ['The venue was closed', 'The speaker was ill', 'The audience was absent', 'The topic changed'], 'The speaker was ill'],
    ['The company introduced mentoring to help new employees understand its processes.', 'What was the purpose of mentoring?', ['To replace all employees', 'To help new employees understand processes', 'To reduce training', 'To change the company name'], 'To help new employees understand processes'],
    ['Although the route was longer, the team chose it because it was safer.', 'Why did the team choose the longer route?', ['It was cheaper', 'It was safer', 'It was faster', 'It had fewer signs'], 'It was safer'],
    ['The museum extended its hours during the festival to accommodate more visitors.', 'Why did the museum extend its hours?', ['To accommodate more visitors', 'To close earlier', 'To reduce exhibits', 'To move locations'], 'To accommodate more visitors'],
    ['The researcher repeated the experiment to confirm that the result was reliable.', 'Why was the experiment repeated?', ['To change the result', 'To confirm reliability', 'To avoid recording data', 'To shorten the study'], 'To confirm reliability'],
    ['The team shared a draft early so colleagues could suggest improvements.', 'Why was the draft shared early?', ['To prevent feedback', 'To invite suggestions for improvement', 'To finalize it immediately', 'To hide mistakes'], 'To invite suggestions for improvement'],
  ].map(([passage, prompt, options, correctAnswer]) => ({ qtype: 'mcq', category: 'Reading Comprehension', passage, prompt, options, correctAnswer, points: 1 })),
  ...[
    ['Choose the correct transformation: “She completed the report.”', ['The report was completed by her.', 'The report completes her.', 'The report is completing her.', 'She was completed by the report.'], 'The report was completed by her.'],
    ['Choose the correct transformation: “He is too tired to walk.”', ['He is so tired that he cannot walk.', 'He is tired and walks quickly.', 'He walks because he is tired.', 'He is not tired enough to walk.'], 'He is so tired that he cannot walk.'],
    ['Choose the correct transformation: “Unless you hurry, you will miss the bus.”', ['If you do not hurry, you will miss the bus.', 'If you hurry, you will miss the bus.', 'You will never miss the bus.', 'You hurried before the bus.'], 'If you do not hurry, you will miss the bus.'],
    ['Choose the correct transformation: “The test was difficult, but she passed.”', ['Although the test was difficult, she passed.', 'Because the test was difficult, she failed.', 'The test was easy and she passed.', 'She passed before the test.'], 'Although the test was difficult, she passed.'],
    ['Choose the correct transformation: “I last met him in 2022.”', ['I have not met him since 2022.', 'I meet him every year since 2022.', 'I met him before 2022 only.', 'I will meet him in 2022.'], 'I have not met him since 2022.'],
    ['Choose the correct transformation: “The room is so small that it cannot hold 50 people.”', ['The room is too small to hold 50 people.', 'The room is large enough for 50 people.', 'The room holds exactly 50 people.', 'The room was built by 50 people.'], 'The room is too small to hold 50 people.'],
    ['Choose the correct transformation: “As soon as the bell rang, the students left.”', ['No sooner did the bell ring than the students left.', 'The students left before the bell rang.', 'The bell left the students.', 'The students never heard the bell.'], 'No sooner did the bell ring than the students left.'],
    ['Choose the correct transformation: “He said, ‘I am busy.’”', ['He said that he was busy.', 'He says he is busy yesterday.', 'He said that I am busy.', 'He asked whether he busy.'], 'He said that he was busy.'],
    ['Choose the correct transformation: “People speak English worldwide.”', ['English is spoken worldwide.', 'English speaks people worldwide.', 'People are spoken by English.', 'English was speaking worldwide.'], 'English is spoken worldwide.'],
    ['Choose the correct transformation: “Despite being tired, she continued working.”', ['Although she was tired, she continued working.', 'Because she was tired, she stopped forever.', 'She was never tired while working.', 'She continued before she became tired.'], 'Although she was tired, she continued working.'],
    ['Choose the correct transformation: “The box is heavier than the bag.”', ['The bag is not as heavy as the box.', 'The bag is heavier than the box.', 'The box is as light as the bag.', 'The box and bag are empty.'], 'The bag is not as heavy as the box.'],
    ['Choose the correct transformation: “You must obey the rules.”', ['The rules must be obeyed.', 'The rules obey you.', 'You are obeyed by rules only.', 'The rules must obey.'], 'The rules must be obeyed.'],
    ['Choose the correct transformation: “If you study, you will pass.”', ['You will pass provided that you study.', 'You pass although you never study.', 'You studied because you failed.', 'You will not pass if you study.'], 'You will pass provided that you study.'],
    ['Choose the correct transformation: “He is the tallest boy in the class.”', ['No other boy in the class is as tall as he is.', 'Every boy is taller than he is.', 'He is shorter than the class.', 'The class has no boys.'], 'No other boy in the class is as tall as he is.'],
    ['Choose the correct transformation: “She opened the window.”', ['The window was opened by her.', 'The window opened her.', 'She was opened by the window.', 'The window is opening her.'], 'The window was opened by her.'],
    ['Choose the correct transformation: “The moment he arrived, the meeting began.”', ['Hardly had he arrived when the meeting began.', 'The meeting began before he arrived.', 'He arrived after the meeting ended.', 'The meeting never began.'], 'Hardly had he arrived when the meeting began.'],
    ['Choose the correct transformation: “It is believed that the plan will succeed.”', ['People believe that the plan will succeed.', 'Nobody believes the plan.', 'The plan believes people.', 'The plan failed yesterday.'], 'People believe that the plan will succeed.'],
    ['Choose the correct transformation: “Work hard or you will fail.”', ['If you do not work hard, you will fail.', 'If you work hard, you will fail.', 'You failed before working.', 'Work is impossible.'], 'If you do not work hard, you will fail.'],
    ['Choose the correct transformation: “He finished the task and then went home.”', ['After finishing the task, he went home.', 'Before starting the task, he went home.', 'He went home instead of finishing.', 'The task went home.'], 'After finishing the task, he went home.'],
    ['Choose the correct transformation: “The teacher praised the student.”', ['The student was praised by the teacher.', 'The teacher was praised by the student only.', 'The student praised the teacher.', 'The teacher is praising the student tomorrow.'], 'The student was praised by the teacher.'],
  ].map(([prompt, options, correctAnswer]) => ({ qtype: 'mcq', category: 'Grammar and Sentence Formation', passage: null, prompt, options, correctAnswer, points: 1 })),
  { qtype: 'behavioral', category: 'Speaking', passage: null, prompt: 'Speaking response: Describe a time you solved a difficult problem. Record or type a clear response with your situation, action, and result.', options: null, correctAnswer: 'clear structured response situation action result communication', points: 5 },
  { qtype: 'behavioral', category: 'Speaking', passage: null, prompt: 'Speaking response: Explain one change you would make to improve communication in a team.', options: null, correctAnswer: 'clear communication practical improvement teamwork explanation', points: 5 },
];

const READING_PASSAGE_ONE = 'Modern cities are increasingly using community gardens to improve both food security and neighbourhood wellbeing. A successful garden is more than a collection of planting beds: it is a shared system that depends on clear rules, patient coordination, and long-term care. Residents may grow vegetables, herbs, and flowers, but they also exchange knowledge about soil, water, and seasonal planning. Researchers have found that gardens can strengthen social connections because people who might otherwise never meet work toward a visible common goal. The benefits are not automatic. Gardens require reliable access to water, fair allocation of space, and an agreed method for resolving disputes. When these arrangements are transparent, volunteers are more willing to contribute time and new members are more likely to participate. Some projects also donate part of their harvest to local food banks. This turns a small green space into an educational, social, and practical resource. The passage suggests that community gardens succeed when their social organisation is treated as seriously as their planting.';
const READING_PASSAGE_TWO = 'Digital tools have changed the way people learn, but access to information alone does not guarantee understanding. Effective learners still need to compare sources, identify assumptions, and test whether a claim is supported by evidence. Online platforms can make these tasks easier by offering searchable archives, interactive demonstrations, and opportunities to receive feedback. They can also make learning harder when notifications encourage constant switching between unrelated tasks. For this reason, many educators recommend a deliberate routine: define a question, choose a small number of reliable sources, take notes in one place, and explain the conclusion in the learner’s own words. This process turns passive browsing into active investigation. It also makes uncertainty visible, which is important because a well-supported answer may still have limits. Digital learning is therefore most powerful when technology is used to extend careful thinking rather than replace it. The learner remains responsible for judging quality, connecting ideas, and deciding what further evidence is needed.';
const READING_QUESTIONS = [
  ['What is the central idea of the first passage?', ['Community gardens succeed through plants alone', 'Community gardens need both cultivation and transparent social organisation', 'Food banks should replace gardens', 'Residents should avoid shared spaces'], 'Community gardens need both cultivation and transparent social organisation', READING_PASSAGE_ONE],
  ['Which arrangement is identified as necessary for a successful garden?', ['Unlimited private ownership', 'Reliable water access and fair space allocation', 'No rules for volunteers', 'A ban on new members'], 'Reliable water access and fair space allocation', READING_PASSAGE_ONE],
  ['Why can community gardens strengthen social connections?', ['People work toward a visible common goal', 'They prevent residents from meeting', 'They remove the need for cooperation', 'They are managed entirely by machines'], 'People work toward a visible common goal', READING_PASSAGE_ONE],
  ['What does transparent organisation encourage?', ['Volunteers to contribute and new members to participate', 'People to stop sharing knowledge', 'Disputes to remain unresolved', 'Harvests to be destroyed'], 'Volunteers to contribute and new members to participate', READING_PASSAGE_ONE],
  ['What additional community benefit is mentioned?', ['Donating harvests to local food banks', 'Replacing all schools', 'Eliminating seasonal planning', 'Selling every garden privately'], 'Donating harvests to local food banks', READING_PASSAGE_ONE],
  ['What does the second passage say about access to information?', ['It automatically guarantees understanding', 'It does not by itself guarantee understanding', 'It prevents evidence testing', 'It makes learning impossible'], 'It does not by itself guarantee understanding', READING_PASSAGE_TWO],
  ['Which activity helps learners judge a claim?', ['Identifying assumptions and checking evidence', 'Switching constantly between tasks', 'Ignoring all sources', 'Copying the first result'], 'Identifying assumptions and checking evidence', READING_PASSAGE_TWO],
  ['What routine do educators recommend?', ['Define a question, select reliable sources, take notes, and explain the conclusion', 'Browse without a question', 'Use unlimited notifications', 'Avoid feedback'], 'Define a question, select reliable sources, take notes, and explain the conclusion', READING_PASSAGE_TWO],
  ['What can notifications do to learning?', ['Encourage constant switching between unrelated tasks', 'Make all evidence reliable', 'Remove the need for notes', 'Guarantee concentration'], 'Encourage constant switching between unrelated tasks', READING_PASSAGE_TWO],
  ['According to the passage, who remains responsible for judging quality?', ['The learner', 'The search engine alone', 'The notification system', 'The archive'], 'The learner', READING_PASSAGE_TWO],
].map(([prompt, options, correctAnswer, passage]) => ({ qtype: 'mcq', category: 'Reading Comprehension', passage, prompt, options, correctAnswer, points: 1 }));

async function seed() {
  const db = await getDb();

  for (const company of COMPANIES) {
    await db.collection('companies').updateOne({ slug: company.slug }, { $setOnInsert: company }, { upsert: true });
  }

  const companies = await db.collection('companies').find({}).toArray();
  const now = new Date();

  for (const company of companies) {
    const existingCount = await db.collection('questionBank').countDocuments({ companyId: company._id });
    await db.collection('questionBank').deleteMany({ companyId: company._id, round: 'english', category: 'Reading Comprehension' });
    const aptitudeCount = await db.collection('questionBank').countDocuments({ companyId: company._id, round: 'aptitude' });
    const aiTechnicalCount = await db.collection('questionBank').countDocuments({ companyId: company._id, round: 'ai_technical' });
    const coding1Count = await db.collection('questionBank').countDocuments({ companyId: company._id, round: 'coding1' });
    const coding2Count = await db.collection('questionBank').countDocuments({ companyId: company._id, round: 'coding2' });
    const technicalInterviewCount = await db.collection('questionBank').countDocuments({ companyId: company._id, round: 'technical_interview' });

    const docs = [
      ...(existingCount === 0 ? ENGLISH_QUESTIONS.filter((q) => q.category !== 'Reading Comprehension') : []).map((q) => ({ ...q, companyId: company._id, round: 'english', createdAt: now })),
      ...READING_QUESTIONS.map((q) => ({ ...q, companyId: company._id, round: 'english', createdAt: now })),
      ...APTITUDE_QUESTIONS
        .slice(aptitudeCount)
        .map((q) => ({ ...q, companyId: company._id, round: 'aptitude', createdAt: now })),
      ...AI_TECHNICAL_QUESTIONS
        .slice(aiTechnicalCount)
        .map((q) => ({ ...q, companyId: company._id, round: 'ai_technical', createdAt: now })),
      ...CODING1_QUESTIONS
        .slice(coding1Count)
        .map((q) => ({ ...q, companyId: company._id, round: 'coding1', createdAt: now })),
      ...CODING2_QUESTIONS
        .slice(coding2Count)
        .map((q) => ({ ...q, companyId: company._id, round: 'coding2', createdAt: now })),
      ...TECHNICAL_INTERVIEW_QUESTIONS
        .slice(technicalInterviewCount)
        .map((q) => ({ ...q, companyId: company._id, round: 'technical_interview', createdAt: now })),
    ];
    if (existingCount === 0) {
      docs.push(
        ...TECHNICAL_QUESTIONS.map((q) => ({ ...q, companyId: company._id, round: 'technical', createdAt: now })),
        ...PERSONAL_QUESTIONS.map((q) => ({ ...q, companyId: company._id, round: 'personal', createdAt: now })),
        ...HR_QUESTIONS.map((q) => ({ ...q, companyId: company._id, round: 'hr', createdAt: now })),
      );
    }
    await db.collection('questionBank').insertMany(docs);
    // eslint-disable-next-line no-console
    console.log(`Seeded ${docs.length} questions for ${company.name}`);
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

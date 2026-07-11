-- Seed data: companies + a shared placeholder question bank (migrated from the app's
-- previously-hardcoded TechnicalRound.tsx / HRSimulation.tsx content). All four companies
-- point at the same question set for now — replace per-company content later via the
-- recruiter-only question_bank RLS policy; no schema change needed to do so.

insert into public.companies (name, slug, pass_threshold_pct, technical_duration_min, personal_duration_min, hr_duration_min)
values
  ('TCS', 'tcs', 60, 45, 30, 20),
  ('Wipro', 'wipro', 60, 45, 30, 20),
  ('Infosys', 'infosys', 60, 45, 30, 20),
  ('General', 'general', 60, 45, 30, 20)
on conflict (name) do nothing;

with technical_questions(qtype, category, prompt, options, correct_answer, points) as (
  values
    ('mcq', 'DSA', 'What is the time complexity of binary search?', '["O(n)","O(log n)","O(n²)","O(1)"]'::jsonb, 'O(log n)', 2),
    ('mcq', 'DSA', 'Which data structure uses LIFO principle?', '["Queue","Stack","Array","Tree"]'::jsonb, 'Stack', 2),
    ('mcq', 'DSA', 'What is the worst-case time complexity of quicksort?', '["O(n log n)","O(n²)","O(n)","O(log n)"]'::jsonb, 'O(n²)', 2),
    ('mcq', 'DSA', 'Which traversal technique is used in DFS?', '["Queue","Stack","Array","Linked List"]'::jsonb, 'Stack', 2),
    ('mcq', 'DSA', 'What is the space complexity of merge sort?', '["O(1)","O(log n)","O(n)","O(n²)"]'::jsonb, 'O(n)', 2),
    ('mcq', 'Aptitude', 'If a train travels 120 km in 2 hours, what is its speed?', '["50 km/h","60 km/h","70 km/h","80 km/h"]'::jsonb, '60 km/h', 1),
    ('mcq', 'Aptitude', 'A man can complete a work in 12 days. How much work can he complete in 3 days?', '["1/4","1/3","1/2","2/3"]'::jsonb, '1/4', 1),
    ('mcq', 'Aptitude', 'The ratio of 3:4 is equal to?', '["12:16","6:9","9:12","15:18"]'::jsonb, '12:16', 1),
    ('mcq', 'Aptitude', 'If 5 books cost $25, what is the cost of 8 books?', '["$35","$40","$45","$50"]'::jsonb, '$40', 1),
    ('mcq', 'Aptitude', 'What comes next in the series: 2, 6, 12, 20, ?', '["28","30","32","34"]'::jsonb, '30', 1),
    ('mcq', 'Quant', 'What is 15% of 240?', '["36","32","38","34"]'::jsonb, '36', 1),
    ('mcq', 'Quant', 'If x + y = 10 and x - y = 4, what is the value of x?', '["6","7","8","9"]'::jsonb, '7', 1),
    ('mcq', 'Quant', 'What is the area of a circle with radius 7?', '["154","144","164","174"]'::jsonb, '154', 1),
    ('mcq', 'Quant', 'If log₂(8) = x, what is x?', '["2","3","4","5"]'::jsonb, '3', 1),
    ('mcq', 'Quant', 'What is the compound interest on $1000 at 10% for 2 years?', '["$200","$210","$220","$230"]'::jsonb, '$210', 1),
    ('coding', 'DSA', 'Write a function to reverse a linked list.', null, 'iterative or recursive approach', 5),
    ('coding', 'DSA', 'Implement binary search algorithm.', null, 'divide and conquer approach', 5),
    ('coding', 'DSA', 'Find the maximum element in an array.', null, 'iterate through array', 3),
    ('coding', 'DSA', 'Check if a string is palindrome.', null, 'two pointer approach', 3),
    ('coding', 'DSA', 'Implement stack using arrays.', null, 'push, pop, top operations', 4),
    ('mcq', 'DSA', 'What is the height of a complete binary tree with n nodes?', '["log₂(n)","⌊log₂(n)⌋","⌈log₂(n+1)⌉","n"]'::jsonb, '⌊log₂(n)⌋', 2),
    ('mcq', 'Aptitude', 'A pipe can fill a tank in 6 hours. Another pipe can empty it in 8 hours. How long to fill the tank if both are open?', '["24 hours","20 hours","18 hours","16 hours"]'::jsonb, '24 hours', 1),
    ('mcq', 'Quant', 'What is the probability of getting a head when flipping a fair coin?', '["0.25","0.5","0.75","1"]'::jsonb, '0.5', 1),
    ('mcq', 'DSA', 'Which sorting algorithm is stable?', '["Quick Sort","Heap Sort","Merge Sort","Selection Sort"]'::jsonb, 'Merge Sort', 2),
    ('mcq', 'Aptitude', 'If today is Monday, what day will it be after 100 days?', '["Monday","Tuesday","Wednesday","Thursday"]'::jsonb, 'Tuesday', 1)
),
hr_questions(category, prompt, correct_answer) as (
  values
    ('Behavioral', E'Tell me about yourself and why you\'re interested in this position.', 'background experience skills interest role motivation career goals'),
    ('Behavioral', 'Describe a challenging situation you faced and how you overcame it.', 'challenge problem obstacle solution action result overcame learned'),
    ('Behavioral', 'Where do you see yourself in five years?', 'career growth goals development future plan aspiration'),
    ('Behavioral', 'What are your greatest strengths and weaknesses?', 'strength weakness self awareness improvement skill'),
    ('Behavioral', 'Why should we hire you over other candidates?', 'unique value skills experience fit contribution strength'),
    ('Behavioral', 'Describe a time when you had to work in a team to achieve a goal.', 'team collaboration goal cooperation communication result'),
    ('Behavioral', 'How do you handle stress and pressure?', 'stress pressure manage cope prioritize calm strategy'),
    ('Behavioral', 'What motivates you in your work?', 'motivation passion drive purpose reward growth'),
    ('Behavioral', 'Tell me about a time you failed and what you learned from it.', 'failure mistake lesson learned improvement growth reflection'),
    ('Behavioral', 'How do you stay updated with industry trends and technologies?', 'learning trends technology industry courses reading updated')
)
insert into public.question_bank (company_id, round, qtype, category, prompt, options, correct_answer, points)
select c.id, 'technical', t.qtype, t.category, t.prompt, t.options, t.correct_answer, t.points
from public.companies c cross join technical_questions t
union all
select c.id, 'hr', 'behavioral', h.category, h.prompt, null, h.correct_answer, 1
from public.companies c cross join hr_questions h;

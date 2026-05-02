// Render specification — field → render type mapping
// This is the single source of truth. Frontend reads this to decide how to display
// each field. AI prompts read this to generate format instructions for each field type.
//
// 5 render types:
//   text           → single-line span
//   comma_list     → tag cloud / badges      data: "R, Python, SQL"
//   semicolon_list → bullet <ul><li>         data: "内容1；内容2；内容3"
//   card_list      → independent card group  data: [ { ... }, { ... } ]
//   date           → formatted date           data: "2024-07"

// ── Render type descriptors (used by prompts.js to auto-generate AI format rules) ──

export const RENDER_TYPE_RULES = {
  text:           { description: '直接填写字符串，不要加引号或标记' },
  comma_list:     { description: '用英文逗号+空格分隔各项', example: 'R, Python, SQL, ggplot2', splitter: 'comma' },
  semicolon_list: { description: '用中文分号（；）分隔各短句，不要编号，不要换行', example: '协助数据处理；使用 SPSS 分析调研数据；撰写报告支持决策', splitter: 'semicolon' },
  date:           { description: '日期格式 YYYY-MM，如未知则留空', example: '2024-07', format: 'YYYY-MM' },
  card_list:      { description: '每个元素是一个独立对象，字段见各条目定义' },
}

// ── Profile field → render mapping ──

export const PROFILE_RENDER = {
  full_name:    { render: 'text', label: '姓名' },
  gender:       { render: 'text', label: '性别' },
  age:          { render: 'text', label: '年龄' },
  phone:        { render: 'text', label: '电话' },
  email:        { render: 'text', label: '邮箱' },
  wechat:       { render: 'text', label: '微信' },
  github:       { render: 'text', label: 'GitHub' },
  location:     { render: 'text', label: '所在地' },
  graduation:   { render: 'date', label: '毕业时间' },
  target_role:  { render: 'text', label: '目标岗位' },
  summary:      { render: 'text', label: '求职定位' },
  skills:       { render: 'comma_list', label: '技能' },
  education: {
    render: 'card_list', label: '教育背景',
    fields: {
      school:       { render: 'text', label: '学校' },
      degree:       { render: 'text', label: '学历' },
      major:        { render: 'text', label: '专业' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      gpa:          { render: 'text', label: 'GPA' },
      description:  { render: 'semicolon_list', label: '描述' },
    }
  },
  experience: {
    render: 'card_list', label: '工作经历',
    fields: {
      company:      { render: 'text', label: '公司' },
      position:     { render: 'text', label: '职位' },
      role:         { render: 'text', label: '角色' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      description:  { render: 'semicolon_list', label: '工作内容' },
    }
  },
  projects: {
    render: 'card_list', label: '项目经历',
    fields: {
      name:         { render: 'text', label: '项目名' },
      role:         { render: 'text', label: '角色' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      description:  { render: 'semicolon_list', label: '项目内容' },
      tech_stack:   { render: 'comma_list', label: '技术栈' },
    }
  },
}
